"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  IS_TYPESENSE_ENABLED,
  searchProducts as tsSearchProducts,
  ensureCollectionOnce,
} from "@/lib/search/typesense-client";
import { getCategoryDescendantIds } from "./category";
import { SerializedProduct } from "@/lib/types/search";
import { unstable_cache } from "next/cache";
import { splitCctForIndex, getCctType } from "@/lib/search/utils";

export type SearchParams = {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  priceRange?: [number, number];
  specs?: Record<string, string | string[]>;
  sort?: "price_asc" | "price_desc" | "newest";
  page?: number;
  discountedOnly?: boolean;
  availability?: "in_stock" | "out_of_stock";
};

export type Facet = {
  label: string;
  options: { value: string; count: number }[];
};

export type SearchResult = {
  products: SerializedProduct[];
  total: number;
  facets: Record<string, Facet>;
  minPrice: number;
  maxPrice: number;
  colorMap: Record<string, string>;
};

async function dbSearchProducts(params: SearchParams): Promise<SearchResult> {
  const startTime = performance.now();
  console.log("Starting DB Search with params:", JSON.stringify(params));

  const {
    query,
    categoryId,
    priceRange,
    specs,
    sort,
    page = 1,
    discountedOnly,
    availability,
  } = params;
  const pageSize = 12;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (categoryId) {
    const categoryIds = await getCategoryDescendantIds(categoryId);
    where.categoryId = { in: categoryIds };
  }

  if (query) {
    where.OR = [
      { slug: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      { brand: { contains: query, mode: "insensitive" } },
      { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
      {
        content: {
          path: ["es", "name"],
          string_contains: query,
        },
      },
      {
        content: {
          path: ["en", "name"],
          string_contains: query,
        },
      },
    ];
  }

  const variantWhere: Prisma.ProductVariantWhereInput = {};

  if (specs) {
    const specFilters: Prisma.ProductVariantWhereInput[] = [];
    Object.entries(specs).forEach(([key, value]) => {
      // brand is a top-level Product field, not a variant spec
      if (key === "brand") {
        const vals = Array.isArray(value) ? value : [value];
        if (vals.length > 0) {
          where.brand = { in: vals.filter(Boolean) as string[] };
        }
        return;
      }

      // cct: use string_contains so "3000K" also matches "3000K-4000K-6000K"
      if (key === "cct") {
        const vals = Array.isArray(value) ? value : [value];
        if (vals.length > 0) {
          specFilters.push({
            OR: vals.map((v) => ({
              specs: { path: ["cct"], string_contains: v },
            })),
          });
        }
        return;
      }

      // cct_type: reverse-map to actual cct patterns
      if (key === "cct_type") {
        const vals = Array.isArray(value) ? value : [value];
        const cctConditions: Prisma.ProductVariantWhereInput[] = [];
        for (const type of vals) {
          if (type === "Cálido") {
            for (const k of ["2000K", "2200K", "2700K", "3000K"]) {
              cctConditions.push({ specs: { path: ["cct"], string_contains: k } });
            }
          } else if (type === "Neutro") {
            for (const k of ["3500K", "4000K"]) {
              cctConditions.push({ specs: { path: ["cct"], string_contains: k } });
            }
          } else if (type === "Frío") {
            for (const k of ["5000K", "6000K", "6500K"]) {
              cctConditions.push({ specs: { path: ["cct"], string_contains: k } });
            }
          } else if (type === "Regulable") {
            cctConditions.push({ specs: { path: ["cct"], string_contains: "-" } });
            cctConditions.push({ specs: { path: ["cct"], equals: "CCT" } });
          } else if (type === "RGB") {
            cctConditions.push({ specs: { path: ["cct"], string_contains: "RGB" } });
          } else if (type === "Color") {
            for (const c of ["Azul", "Rojo", "Rosa", "Morado", "Verde", "Dorado", "Naranja", "Amarillo"]) {
              cctConditions.push({ specs: { path: ["cct"], equals: c } });
            }
          }
        }
        if (cctConditions.length > 0) {
          specFilters.push({ OR: cctConditions });
        }
        return;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          specFilters.push({
            OR: value.map((v) => ({
              specs: {
                path: [key],
                equals: v,
              },
            })),
          });
        }
      } else if (value) {
        specFilters.push({
          specs: {
            path: [key],
            equals: value,
          },
        });
      }
    });

    if (specFilters.length > 0) {
      variantWhere.AND = specFilters;
    }
  }

  if (discountedOnly) {
    variantWhere.compareAtPrice = { not: null };
  }

  if (Object.keys(variantWhere).length > 0) {
    where.variants = {
      some: variantWhere,
    };
  }

  const baseWhere = { ...where };

  const allMatches = await db.product.findMany({
    where: baseWhere,
    take: 10000, // Safety limit to prevent memory overflow on large datasets
    select: {
      id: true,
      createdAt: true,
      sortOrder: true,
      variants: {
        where: variantWhere,
        select: {
          price: true,
          specs: true,
          physicalStock: true,
        },
      },
    },
  });

  const facetMap: Record<string, Map<string, number>> = {};
  let globalMinPrice = Number.MAX_SAFE_INTEGER;
  let globalMaxPrice = 0;
  const colorSet = new Set<string>();
  const filteredMeta: {
    id: string;
    createdAt: Date;
    sortOrder: number;
    minPrice: number;
    maxPrice: number;
  }[] = [];

  for (const p of allMatches) {
    const prices = p.variants.map((v) => Number(v.price));
    if (prices.length === 0) continue;

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);

    if (minP < globalMinPrice) globalMinPrice = minP;
    if (maxP > globalMaxPrice) globalMaxPrice = maxP;

    let matchesPrice = true;
    if (priceRange) {
      matchesPrice = p.variants.some(
        (v) =>
          Number(v.price) >= priceRange[0] && Number(v.price) <= priceRange[1]
      );
    }

    let matchesAvailability = true;
    if (availability === "in_stock") {
      matchesAvailability = p.variants.some((v) => v.physicalStock > 0);
    } else if (availability === "out_of_stock") {
      matchesAvailability = p.variants.every((v) => v.physicalStock <= 0);
    }

    if (matchesPrice && matchesAvailability) {
      filteredMeta.push({
        id: p.id,
        createdAt: p.createdAt,
        sortOrder: p.sortOrder,
        minPrice: minP,
        maxPrice: maxP,
      });

      p.variants.forEach((v) => {
        if (v.specs && typeof v.specs === "object") {
          Object.entries(v.specs).forEach(([key, value]) => {
            if (value && key !== "series" && key !== "origin") {
              const valStr = String(value);

              // CCT: split multi-CCT into individual values + derive cct_type
              if (key === "cct") {
                if (!facetMap["cct"]) facetMap["cct"] = new Map();
                const parts = splitCctForIndex(valStr);
                for (const part of parts) {
                  facetMap["cct"].set(part, (facetMap["cct"].get(part) || 0) + 1);
                }
                if (!facetMap["cct_type"]) facetMap["cct_type"] = new Map();
                const cctType = getCctType(valStr);
                facetMap["cct_type"].set(cctType, (facetMap["cct_type"].get(cctType) || 0) + 1);
                return;
              }

              if (!facetMap[key]) facetMap[key] = new Map();
              facetMap[key].set(valStr, (facetMap[key].get(valStr) || 0) + 1);

              if (key === "color" || key === "finish") {
                colorSet.add(valStr);
              }
            }
          });
        }
      });
    }
  }

  if (globalMinPrice === Number.MAX_SAFE_INTEGER) globalMinPrice = 0;

  if (sort === "price_asc") {
    filteredMeta.sort((a, b) => a.minPrice - b.minPrice);
  } else if (sort === "price_desc") {
    filteredMeta.sort((a, b) => b.minPrice - a.minPrice);
  } else if (sort === "newest") {
    filteredMeta.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else {
    // Default: sort by sortOrder ascending
    filteredMeta.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const total = filteredMeta.length;
  const startIndex = (page - 1) * pageSize;
  const slicedMeta = filteredMeta.slice(startIndex, startIndex + pageSize);
  const targetIds = slicedMeta.map((p) => p.id);

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "newest") {
    orderBy = { createdAt: "desc" };
  }

  const pagedProducts = await db.product.findMany({
    where:
      targetIds.length > 0
        ? { id: { in: targetIds } }
        : { id: { in: ["__empty__"] } },
    orderBy,
    include: {
      variants: true,
      category: true,
    },
  });

  const orderedProducts = slicedMeta
    .map((meta) => {
      const product = pagedProducts.find((p) => p.id === meta.id);
      if (!product) return null;
      return {
        ...product,
        variants: product.variants.map((v) => ({
          ...v,
          price: Number(v.price),
          b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : null,
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          costPrice: v.costPrice ? Number(v.costPrice) : null,
        })),
        minPrice: meta.minPrice,
        maxPrice: meta.maxPrice,
      };
    })
    .filter(Boolean) as SerializedProduct[];

  const colorMap: Record<string, string> = {};
  if (colorSet.size > 0) {
    const attributeOptions = await db.attributeOption.findMany({
      where: {
        attribute: {
          key: { in: ["color", "finish"] },
        },
        value: { in: Array.from(colorSet) },
      },
      select: {
        value: true,
        color: true,
      },
    });

    attributeOptions.forEach((opt) => {
      if (opt.color) {
        colorMap[opt.value.toLowerCase()] = opt.color;
      }
    });
  }

  // 3. Facets
  let facets: Record<string, Facet> = {};

  if (params.query) {
    // No DB facets for query search for now
  } else {
    // Only run expensive aggregations if needed
    Object.entries(facetMap).forEach(([key, map]) => {
      const label =
        key.charAt(0).toUpperCase() +
        key
          .slice(1)
          .replace(/([A-Z])/g, " $1")
          .trim();

      facets[key] = {
        label,
        options: Array.from(map.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      };
    });
  }

  const endTime = performance.now();
  console.log(`DB Search took ${(endTime - startTime).toFixed(2)}ms`);

  return {
    products: orderedProducts,
    total,
    facets,
    minPrice: globalMinPrice,
    maxPrice: globalMaxPrice,
    colorMap,
  };
}

async function _searchProductsImpl(
  params: SearchParams
): Promise<SearchResult> {
  const startTime = performance.now();

  if (IS_TYPESENSE_ENABLED && !params.availability) {
    console.log("Using Typesense search for:", params.query || "*");
    try {
      await ensureCollectionOnce();
      const escapeFilterValue = (input: string) =>
        input.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
      const {
        query,
        categoryId,
        categorySlug: paramCategorySlug,
        priceRange,
        specs,
        sort,
        page = 1,
        discountedOnly,
      } = params;

      // 1. Build Filter String
      const filters: string[] = ["isActive:true"];

      let categorySlug = paramCategorySlug;
      if (!categorySlug && categoryId) {
        const category = await db.category.findUnique({
          where: { id: categoryId },
          select: { slug: true },
        });
        categorySlug = category?.slug;
      }

      if (categorySlug) {
        filters.push(`category_path:=${categorySlug}`);
      }

      // Price Range
      if (priceRange) {
        filters.push(
          `minPrice:>=${priceRange[0]} && minPrice:<=${priceRange[1]}`
        );
      }

      // Specs (Dynamic Attributes) + top-level facets (brand, tags)
      if (specs) {
        const TOP_LEVEL_FACETS = new Set(["brand", "tags"]);
        Object.entries(specs).forEach(([key, value]) => {
          if (TOP_LEVEL_FACETS.has(key)) {
            // brand / tags are top-level Typesense fields, not inside specs_kv
            if (Array.isArray(value)) {
              if (value.length > 0) {
                const values = value.map((v) => escapeFilterValue(String(v))).join(",");
                filters.push(`${key}:=[${values}]`);
              }
            } else if (value) {
              filters.push(`${key}:=[${escapeFilterValue(String(value))}]`);
            }
          } else if (Array.isArray(value)) {
            if (value.length > 0) {
              const values = value
                .map((v) => `${key}=${escapeFilterValue(String(v))}`)
                .join(",");
              filters.push(`specs_kv:=[${values}]`);
            }
          } else if (value) {
            const encoded = `${key}=${escapeFilterValue(String(value))}`;
            filters.push(`specs_kv:=[${encoded}]`);
          }
        });
      }

      // Discounted Only
      if (discountedOnly) {
        filters.push(`compareAtPrice:>0`);
      }

      // 2. Build Sort String
      let sortBy = "sortOrder:asc,_text_match:desc,minPrice:asc"; // Default
      if (sort === "price_asc") sortBy = "minPrice:asc";
      else if (sort === "price_desc") sortBy = "minPrice:desc";
      else if (sort === "newest") sortBy = "createdAt:desc";

      // 3. Execute Search
      const facetFields = "brand,tags,specs_kv,minPrice";

      console.time("Typesense Search");
      const {
        hits,
        total,
        facets: tsFacets,
      } = await tsSearchProducts(query || "*", {
        filterBy: filters.join(" && "),
        sortBy,
        page,
        perPage: 12,
        facetBy: facetFields,
      });
      console.timeEnd("Typesense Search");

      // 4. Transform Results
      const orderedProducts = hits.map((hit) => {
        const variantsData = hit.variants_json
          ? JSON.parse(hit.variants_json)
          : [];

        // Construct variants
        const variants = variantsData.map((v: Record<string, unknown>) => ({
          id: v.id as string,
          sku: v.sku as string,
          price: Number(v.price),
          physicalStock: (v.physicalStock as number) ?? 0,
          allocatedStock: (v.allocatedStock as number) ?? 0,
          specs: v.specs,
          productId: hit.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          ean: null,
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          costPrice: 0,
          b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : null,
          minStock: 0,
          supplierId: null,
        }));

        // Construct product
        const product = {
          id: hit.id,
          slug: hit.slug,
          sku: hit.sku_list?.[0] || "",
          brand: hit.brand || null,
          isActive: true,
          createdAt: hit.createdAt ? new Date(hit.createdAt) : new Date(),
          updatedAt: new Date(),
          categoryId: "ts-category",
          supplierId: null,
          isBundle: false,
          content: {
            images:
              hit.images && hit.images.length > 0
                ? hit.images
                : hit.imageUrl
                  ? [hit.imageUrl]
                  : [],
            es: {
              name: hit.name,
              description: "",
              images:
                hit.images && hit.images.length > 0
                  ? hit.images
                  : hit.imageUrl
                    ? [hit.imageUrl]
                    : [],
            },
            en: {
              name: hit.name_en || hit.name,
              description: "",
              images:
                hit.images && hit.images.length > 0
                  ? hit.images
                  : hit.imageUrl
                    ? [hit.imageUrl]
                    : [],
            },
          },
          category: {
            id: "ts-category",
            slug: hit.categorySlug || "",
            content: {
              es: { name: hit.categoryName || "" },
              en: { name: hit.categoryName || "" },
            },
          },
          variants: variants,
          minPrice: hit.minPrice,
          maxPrice: hit.maxPrice || hit.minPrice,
        };

        return product;
      }) as unknown as SerializedProduct[];

      // 5. Transform Facets
      const INTERNAL_FACETS = new Set(["minPrice", "category_path", "compareAtPrice", "createdAt", "isActive", "prices", "categorySlug"]);
      const finalFacets: Record<string, Facet> = {};
      Object.entries(tsFacets).forEach(([key, facet]) => {
        if (INTERNAL_FACETS.has(key)) return;
        if (key === "specs_kv") {
          facet.options.forEach((option) => {
            const raw = String(option.value);
            const splitIndex = raw.indexOf("=");
            if (splitIndex <= 0) return;
            const specKey = raw.slice(0, splitIndex);
            const specValue = raw.slice(splitIndex + 1);
            if (!finalFacets[specKey]) {
              const label =
                specKey.charAt(0).toUpperCase() +
                specKey
                  .slice(1)
                  .replace(/([A-Z])/g, " $1")
                  .replace(/_/g, " ")
                  .trim();
              finalFacets[specKey] = { label, options: [] };
            }
            const existing = finalFacets[specKey].options.find(
              (opt) => opt.value === specValue
            );
            if (existing) {
              existing.count += option.count;
            } else {
              finalFacets[specKey].options.push({
                value: specValue,
                count: option.count,
              });
            }
          });
          return;
        }

        const label =
          key.charAt(0).toUpperCase() +
          key
            .slice(1)
            .replace(/([A-Z])/g, " $1")
            .replace(/_/g, " ")
            .trim();

        finalFacets[key] = {
          label,
          options: facet.options,
        };
      });

      // 6. Color Map (Optional: Fetch from DB if needed, or skip)
      // For 0 DB query, we skip.
      const colorMap: Record<string, string> = {};

      const endTime = performance.now();
      console.log(
        `Typesense Total Search took ${(endTime - startTime).toFixed(2)}ms`
      );

      // Extract price range from Typesense facet stats (covers ALL matching products)
      // Round to 2 decimals to fix float precision issues (Typesense stores float, not decimal)
      const priceStats = (tsFacets.minPrice as { stats?: { min?: number; max?: number } })?.stats;
      const minPrice = Math.floor((priceStats?.min ?? (orderedProducts.length > 0
        ? Math.min(...orderedProducts.map((p) => p.minPrice))
        : 0)) * 100) / 100;
      const maxPrice = Math.ceil((priceStats?.max ?? (orderedProducts.length > 0
        ? Math.max(...orderedProducts.map((p) => p.maxPrice))
        : 0)) * 100) / 100;

      return {
        products: orderedProducts,
        total,
        facets: finalFacets,
        minPrice,
        maxPrice,
        colorMap,
      };
    } catch (error) {
      console.error("Typesense search failed:", error);
      // Fallback to DB
    }
  }

  return dbSearchProducts(params);
}

const _cachedSearchProducts = unstable_cache(
  _searchProductsImpl,
  ["search-products"],
  { revalidate: 60, tags: ["products"] }
);

export async function searchProducts(
  params: SearchParams
): Promise<SearchResult> {
  return _cachedSearchProducts(params);
}

export async function searchVariants(query: string) {
  if (IS_TYPESENSE_ENABLED) {
    try {
      await ensureCollectionOnce();
      const { hits } = await tsSearchProducts(query || "*", {
        perPage: 20,
        page: 1,
        includeInactive: true,
      });

      const results: Array<{
        id: string;
        sku: string;
        productName: string;
        physicalStock: number;
        price: number;
        costPrice: number;
      }> = [];

      const normalized = query.toLowerCase();
      hits.forEach((hit) => {
        const variantsData = hit.variants_json
          ? JSON.parse(hit.variants_json)
          : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON variants
        variantsData.forEach((v: any) => {
          if (results.length >= 10) return;
          const sku = String(v.sku || "");
          const productName = hit.name_en || hit.name || sku;
          if (
            sku.toLowerCase().includes(normalized) ||
            productName.toLowerCase().includes(normalized)
          ) {
            results.push({
              id: v.id,
              sku,
              productName,
              physicalStock: v.physicalStock ?? 0,
              price: Number(v.price),
              costPrice: v.costPrice ? Number(v.costPrice) : 0,
            });
          }
        });
      });

      if (results.length > 0) return results;
    } catch {}
  }

  const variants = await db.productVariant.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        {
          product: {
            OR: [
              {
                content: {
                  path: ["es", "name"],
                  string_contains: query,
                },
              },
              {
                content: {
                  path: ["en", "name"],
                  string_contains: query,
                },
              },
            ],
          },
        },
      ],
    },
    take: 10,
    include: {
      product: {
        select: {
          content: true,
        },
      },
    },
  });

  return variants.map((v) => {
    const content = v.product.content as Record<string, Record<string, string>> | null;
    const productName = content?.es?.name || content?.en?.name || v.sku;
    return {
      id: v.id,
      sku: v.sku,
      productName,
      physicalStock: v.physicalStock,
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : 0,
    };
  });
}

export type RFQProductResult = {
  productId: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  variants: {
    variantId: string;
    sku: string;
    price: number;
    b2bPrice: number | null;
    stock: number;
  }[];
};

export async function searchProductsForRFQ(
  query: string,
  locale: string = "en"
): Promise<RFQProductResult[]> {
  if (!query || query.length < 2) return [];

  const { requireRole } = await import("@/lib/auth-guard");
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return [];

  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [
        { content: { path: [locale, "name"], string_contains: query } },
        { content: { path: ["en", "name"], string_contains: query } },
        { content: { path: ["es", "name"], string_contains: query } },
        { sku: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
      ],
    },
    take: 8,
    include: {
      variants: {
        take: 5,
        select: {
          id: true,
          sku: true,
          price: true,
          b2bPrice: true,
          physicalStock: true,
          allocatedStock: true,
        },
      },
    },
  });

  return products.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
    const content = p.content as any;
    const name =
      content?.[locale]?.name ||
      content?.en?.name ||
      content?.es?.name ||
      p.sku;
    const images =
      content?.[locale]?.images || content?.images || [];
    return {
      productId: p.id,
      productName: name,
      productSku: p.sku || "",
      imageUrl: images[0] || null,
      variants: p.variants.map((v) => ({
        variantId: v.id,
        sku: v.sku,
        price: Number(v.price),
        b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : null,
        stock: v.physicalStock - v.allocatedStock,
      })),
    };
  });
}
