import db from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ImportProductsDialog } from "@/components/admin/import-products-dialog";
import { ExportProductsButton } from "@/components/admin/export-products-button";
import { ProductsTable } from "@/components/admin/products-table";
import { ProductSearch } from "@/components/admin/product-search";
import { ProductFilter } from "@/components/admin/product-filter";
import { PaginationControl } from "@/components/storefront/pagination-control";
import { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import {
  IS_TYPESENSE_ENABLED,
  searchProducts as tsSearchProducts,
} from "@/lib/search/typesense-client";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { serializeDecimal } from "@/lib/serialize";
import { getActiveWarehouses } from "@/lib/actions/warehouse";

export const dynamic = "force-dynamic";

type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";

interface FilterParams {
  query?: string;
  status?: string;
  categoryIds?: string[];
  typeFilter?: string[];
  supplierIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  stockStatuses?: string[];
  sort?: SortOption;
}

// Compute stock status for a product's variants
function getProductStockStatus(variants: { physicalStock: number; minStock: number }[]): Set<string> {
  const statuses = new Set<string>();
  if (variants.length === 0) {
    statuses.add("out_of_stock");
    return statuses;
  }

  const allOutOfStock = variants.every((v) => v.physicalStock <= 0);
  if (allOutOfStock) {
    statuses.add("out_of_stock");
    return statuses;
  }

  for (const v of variants) {
    if (v.physicalStock > 0 && v.minStock > 0 && v.physicalStock <= v.minStock) {
      statuses.add("low_stock");
    }
    if (v.physicalStock > v.minStock || (v.physicalStock > 0 && v.minStock === 0)) {
      statuses.add("in_stock");
    }
  }

  return statuses;
}

async function getProducts(
  page: number,
  pageSize: number,
  filters: FilterParams
) {
  const { query, status, categoryIds, typeFilter, supplierIds, minPrice, maxPrice, stockStatuses, sort } = filters;
  const skip = (page - 1) * pageSize;
  const where: Prisma.ProductWhereInput = {};

  // Status filter
  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  // Category filter (multi-select)
  if (categoryIds && categoryIds.length > 0) {
    where.categoryId = { in: categoryIds };
  }

  // Product type filter
  if (typeFilter && typeFilter.length > 0) {
    where.type = { in: typeFilter as any };
  }

  // Supplier filter
  if (supplierIds && supplierIds.length > 0) {
    where.supplierId = { in: supplierIds };
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: Prisma.DecimalFilter = {};
    if (minPrice !== undefined) priceCondition.gte = minPrice;
    if (maxPrice !== undefined) priceCondition.lte = maxPrice;
    where.variants = { some: { price: priceCondition } };
  }

  if (query && IS_TYPESENSE_ENABLED) {
    try {
      const { hits, total } = await tsSearchProducts(query, {
        page,
        perPage: pageSize,
        includeInactive: true,
      });
      const ids = hits.map((h) => h.id);
      if (ids.length === 0) return { products: [], total: 0 };

      // Merge Typesense results with additional filters
      const mergedWhere: Prisma.ProductWhereInput = {
        ...where,
        id: { in: ids },
      };

      const products = await db.product.findMany({
        where: mergedWhere,
        include: {
          category: true,
          variants: true,
          supplier: true,
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      let orderedProducts = ids
        .map((id) => productMap.get(id))
        .filter(Boolean) as typeof products;

      // Post-filter by stock status
      if (stockStatuses && stockStatuses.length > 0) {
        orderedProducts = orderedProducts.filter((p) => {
          const pStatuses = getProductStockStatus(p.variants);
          return stockStatuses.some((ss) => pStatuses.has(ss));
        });
      }

      return { products: orderedProducts, total: orderedProducts.length };
    } catch {
    }
  }

  if (query) {
    where.OR = [
      { slug: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      {
        content: {
          path: ["en", "name"],
          string_contains: query,
        },
      },
      {
        content: {
          path: ["es", "name"],
          string_contains: query,
        },
      },
    ];
  }

  // Server-side sorting — isPinned items always first
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { isPinned: "desc" },
    { sortOrder: "asc" },
  ];
  if (sort === "oldest") {
    orderBy = [{ isPinned: "desc" }, { createdAt: "asc" }];
  } else if (sort === "newest") {
    orderBy = [{ isPinned: "desc" }, { createdAt: "desc" }];
  }
  // price_* and stock_* are handled client-side in ProductsTable

  // For stock status filter, we need to fetch more and post-filter
  const needsStockFilter = stockStatuses && stockStatuses.length > 0;
  const fetchSize = needsStockFilter ? pageSize * 5 : pageSize;
  const fetchSkip = needsStockFilter ? 0 : skip;

  const [rawProducts, rawTotal] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
        supplier: true,
      },
      orderBy,
      skip: fetchSkip,
      take: fetchSize,
    }),
    db.product.count({ where }),
  ]);

  if (needsStockFilter) {
    // Post-filter by stock status
    const filtered = rawProducts.filter((p) => {
      const pStatuses = getProductStockStatus(p.variants);
      return stockStatuses!.some((ss) => pStatuses.has(ss));
    });
    const paged = filtered.slice(skip, skip + pageSize);
    return { products: paged, total: filtered.length };
  }

  return { products: rawProducts, total: rawTotal };
}

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations("admin.products");
  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const pageSize = 20;
  const query = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const sort = typeof searchParams.sort === "string" ? searchParams.sort as SortOption : undefined;

  // Parse new multi-value filter params
  const categoryIdParam = typeof searchParams.categoryId === "string" ? searchParams.categoryId : undefined;
  const categoryIds = categoryIdParam ? categoryIdParam.split(",").filter(Boolean) : undefined;

  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const typeFilter = typeParam ? typeParam.split(",").filter(Boolean) : undefined;

  const supplierIdParam = typeof searchParams.supplierId === "string" ? searchParams.supplierId : undefined;
  const supplierIds = supplierIdParam ? supplierIdParam.split(",").filter(Boolean) : undefined;

  const minPrice = typeof searchParams.minPrice === "string" ? Number(searchParams.minPrice) || undefined : undefined;
  const maxPrice = typeof searchParams.maxPrice === "string" ? Number(searchParams.maxPrice) || undefined : undefined;

  const stockStatusParam = typeof searchParams.stockStatus === "string" ? searchParams.stockStatus : undefined;
  const stockStatuses = stockStatusParam ? stockStatusParam.split(",").filter(Boolean) : undefined;

  // Fetch products, categories, and suppliers in parallel
  const [{ products, total }, categories, suppliers, warehouses] = await Promise.all([
    getProducts(page, pageSize, {
      query, status, categoryIds, typeFilter, supplierIds, minPrice, maxPrice, stockStatuses, sort,
    }),
    db.category.findMany(),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getActiveWarehouses(),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <ImportProductsDialog />
            <ExportProductsButton />
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
              <Link href="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" /> {t("actions.add")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <ProductSearch />
        <ProductFilter categories={categories} suppliers={suppliers} />
      </div>

      <ProductsTable products={serializeDecimal(products)} warehouses={warehouses} />

      <div className="flex justify-end">
        <PaginationControl currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
