import { Suspense } from "react";
import db from "@/lib/db";
import { notFound } from "next/navigation";
import { getLocalized } from "@/lib/content";
import { Metadata } from "next";
import { cache } from "react";
import { searchProducts } from "@/lib/actions/search";
import { getGlobalAttributes } from "@/lib/actions/attributes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBatchProductPrices } from "@/lib/pricing";
import { ProductListView } from "@/components/storefront/product-list-view";
import { getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";

const getCategory = cache(async (slug: string) => {
  return await db.category.findUnique({
    where: { slug },
  });
});

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
    params: Promise<{ locale: string; slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const category = await getCategory(params.slug);
  const t = await getTranslations({ locale: params.locale, namespace: "all_products" });

  if (!category) {
    return {
      title: t("category_not_found"),
    };
  }

  const content = getLocalized(category.content, params.locale);

  return {
    title: content.name,
    description: content.description || t("browse_fallback", { name: content.name }),
    openGraph: {
      title: content.name,
      description: content.description,
    },
  };
}

export default async function CategoryPage(
  props: {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const category = await getCategory(params.slug);
  const session = await getServerSession(authOptions);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });
  const isB2B = session?.user?.b2bStatus === "APPROVED";

  if (!category) {
    notFound();
  }

  // Parse Search Params
  const query =
    typeof searchParams.query === "string" ? searchParams.query : undefined;
  const page =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const sort =
    typeof searchParams.sort === "string"
      ? (searchParams.sort as any)
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

  // Extract specs
  const specs: Record<string, string | string[]> = {};
  Object.keys(searchParams).forEach((key) => {
    if (["query", "page", "sort", "minPrice", "maxPrice", "availability"].includes(key)) return;
    const value = searchParams[key];
    if (value) specs[key] = value;
  });

  const parsedParams: any = {
    query,
    categoryId: category.id,
    categorySlug: category.slug,
    page,
    sort,
    priceRange:
      minPrice !== undefined && maxPrice !== undefined
        ? [minPrice, maxPrice]
        : undefined,
    specs,
    availability: availability as any,
  };

  const [{ products, total, facets, minPrice: globalMin, maxPrice: globalMax }, allCategories, attributes] = await Promise.all([
    searchProducts(parsedParams),
    getCachedAllCategories(),
    getGlobalAttributes(),
  ]);

  // Calculate prices for each product using batch query (fix N+1)
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          {t("loading")}
        </div>
      }
    >
      <ProductListView
        initialProducts={products}
        total={total}
        facets={facets}
        attributes={attributes}
        category={category}
        isB2B={isB2B}
        productPrices={productPrices}
        searchParams={searchParams}
        allCategories={allCategories}
        minPrice={globalMin}
        maxPrice={globalMax}
      />
    </Suspense>
  );
}
