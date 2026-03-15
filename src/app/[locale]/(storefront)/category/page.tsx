import db from "@/lib/db";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { CatalogBrowser } from "@/components/storefront/catalog-browser";

const getCategoriesWithCounts = unstable_cache(
  () =>
    db.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            _count: { select: { products: true } },
          },
          orderBy: { slug: "asc" },
        },
        _count: { select: { products: true } },
      },
      orderBy: { slug: "asc" },
    }),
  ["catalog-page-categories"],
  { revalidate: 300, tags: ["categories"] }
);

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale,
    namespace: "catalog_page",
  });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function CatalogPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const categories = await getCategoriesWithCounts();

  return <CatalogBrowser categories={categories as any} />;
}
