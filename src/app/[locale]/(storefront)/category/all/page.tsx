import { Suspense } from "react";
import { Category } from "@prisma/client";
import db from "@/lib/db";
import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { searchProducts } from "@/lib/actions/search";
import { getGlobalAttributes } from "@/lib/actions/attributes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBatchProductPrices } from "@/lib/pricing";
import { ProductListView } from "@/components/storefront/product-list-view";

const getCachedAllCategories = unstable_cache(
  () =>
    db.category.findMany({
      where: { parentId: null },
      include: { children: { include: { children: true } } },
      orderBy: { slug: "asc" },
    }),
  ["storefront-all-categories"],
  { revalidate: 300 }
);

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "all_products" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AllProductsPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  const isB2B = session?.user?.b2bStatus === "APPROVED";

  const query =
    typeof searchParams.query === "string" ? searchParams.query : undefined;
  const page =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const sort =
    typeof searchParams.sort === "string"
      ? searchParams.sort as "price_asc" | "price_desc" | "newest"
      : undefined;
  const minPrice =
    typeof searchParams.minPrice === "string"
      ? Number(searchParams.minPrice)
      : undefined;
  const maxPrice =
    typeof searchParams.maxPrice === "string"
      ? Number(searchParams.maxPrice)
      : undefined;

  const availability =
    typeof searchParams.availability === "string"
      ? searchParams.availability
      : undefined;

  const specs: Record<string, string | string[]> = {};
  Object.keys(searchParams).forEach((key) => {
    if (
      ["query", "page", "sort", "minPrice", "maxPrice", "category", "availability"].includes(
        key
      )
    )
      return;
    const value = searchParams[key];
    if (value) specs[key] = value;
  });

  const categorySlug =
    typeof searchParams.category === "string"
      ? searchParams.category
      : undefined;
  let categoryId: string | undefined;
  let currentCategory = {
    id: "all",
    slug: "all",
    content: {
      en: { name: "All Products", description: "" },
      es: { name: "Todos los Productos", description: "" },
      zh: { name: "全部商品", description: "" },
      fr: { name: "Tous les Produits", description: "" },
      de: { name: "Alle Produkte", description: "" },
      it: { name: "Tutti i Prodotti", description: "" },
      pt: { name: "Todos os Produtos", description: "" },
      nl: { name: "Alle Producten", description: "" },
      pl: { name: "Wszystkie Produkty", description: "" },
    },
    parentId: null,
    imageUrl: null,
    isActive: true,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (categorySlug) {
    const foundCategory = await db.category.findUnique({
      where: { slug: categorySlug },
    });
    if (foundCategory) {
      categoryId = foundCategory.id;
      currentCategory = foundCategory as typeof currentCategory;
    }
  }

  const parsedParams = {
    query,
    page,
    sort,
    categoryId,
    priceRange:
      minPrice !== undefined && maxPrice !== undefined
        ? [minPrice, maxPrice] as [number, number]
        : undefined,
    specs,
    availability: availability as "in_stock" | "out_of_stock" | undefined,
  };

  const [{ products, total, facets, minPrice: globalMin, maxPrice: globalMax }, allCategories, attributes] = await Promise.all([
    searchProducts(parsedParams),
    getCachedAllCategories(),
    getGlobalAttributes(),
  ]);

  const productPrices: Record<string, number> = {};
  if (session?.user?.id) {
    const variantIds: string[] = [];
    const productVariantMap: Record<string, string> = {};

    products.forEach((p) => {
      if (p.variants.length > 0) {
        const vId = p.variants[0].id;
        variantIds.push(vId);
        productVariantMap[vId] = p.id;
      }
    });

    if (variantIds.length > 0) {
      const batchPrices = await getBatchProductPrices(
        session.user.id,
        variantIds
      );

      Object.entries(batchPrices).forEach(([vId, price]) => {
        const pId = productVariantMap[vId];
        if (pId) {
          productPrices[pId] = price;
        }
      });
    }
  }

  return (
    <ProductListView
      initialProducts={products}
      total={total}
      facets={facets}
      attributes={attributes}
      category={currentCategory as Category}
      isB2B={isB2B}
      productPrices={productPrices}
      searchParams={searchParams}
      allCategories={allCategories}
      useQueryParams={true}
      minPrice={globalMin}
      maxPrice={globalMax}
    />
  );
}
