import { Suspense } from "react";
import db from "@/lib/db";
import { Metadata } from "next";
import { searchProducts } from "@/lib/actions/search";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBatchProductPrices } from "@/lib/pricing";
import { ProductListView } from "@/components/storefront/product-list-view";
import { unstable_cache } from "next/cache";

const getCategoryTree = unstable_cache(
  async () =>
    db.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: { slug: "asc" },
    }),
  ["category-tree"],
  { revalidate: 3600 }
);

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const titles: Record<string, string> = {
    en: "Special Offers",
    es: "Ofertas Especiales",
    zh: "特别优惠",
    fr: "Offres Spéciales",
    de: "Sonderangebote",
    it: "Offerte Speciali",
    pt: "Ofertas Especiais",
    nl: "Speciale Aanbiedingen",
    pl: "Oferty Specjalne",
  };
  const descriptions: Record<string, string> = {
    en: "Exclusive discounts on LED lighting.",
    es: "Descuentos exclusivos en iluminación LED.",
    zh: "LED照明产品专属折扣优惠。",
    fr: "Remises exclusives sur l'éclairage LED.",
    de: "Exklusive Rabatte auf LED-Beleuchtung.",
    it: "Sconti esclusivi sull'illuminazione LED.",
    pt: "Descontos exclusivos em iluminação LED.",
    nl: "Exclusieve kortingen op LED-verlichting.",
    pl: "Ekskluzywne zniżki na oświetlenie LED.",
  };
  const locale = params.locale;
  return {
    title: titles[locale] ?? titles.en,
    description: descriptions[locale] ?? descriptions.en,
  };
}

export default async function OffersPage(
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

  const specs: Record<string, string | string[]> = {};
  Object.keys(searchParams).forEach((key) => {
    if (
      ["query", "page", "sort", "minPrice", "maxPrice", "category"].includes(
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

  // Custom category object for "Offers" page
  let currentCategory = {
    id: "offers",
    slug: "offers",
    content: {
      en: { name: "Special Offers", description: "Exclusive discounts on LED lighting." },
      es: { name: "Ofertas Especiales", description: "Descuentos exclusivos en iluminación LED." },
      zh: { name: "特别优惠", description: "LED照明产品专属折扣优惠。" },
      fr: { name: "Offres Spéciales", description: "Remises exclusives sur l'éclairage LED." },
      de: { name: "Sonderangebote", description: "Exklusive Rabatte auf LED-Beleuchtung." },
      it: { name: "Offerte Speciali", description: "Sconti esclusivi sull'illuminazione LED." },
      pt: { name: "Ofertas Especiais", description: "Descontos exclusivos em iluminação LED." },
      nl: { name: "Speciale Aanbiedingen", description: "Exclusieve kortingen op LED-verlichting." },
      pl: { name: "Oferty Specjalne", description: "Ekskluzywne zniżki na oświetlenie LED." },
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
      // If a specific category is selected within offers, we might want to update the title, 
      // but keeping it simple for now, as ProductListView handles category display if needed.
      // However, for this page, we act as if we are in "Offers" root category conceptually.
    }
  }

  const parsedParams: any = {
    query,
    page,
    sort,
    categoryId,
    categorySlug,
    discountedOnly: true, // Key addition for this page
    priceRange:
      minPrice !== undefined && maxPrice !== undefined
        ? [minPrice, maxPrice]
        : undefined,
    specs,
  };

  const [{ products, total, facets }, allCategories] = await Promise.all([
    searchProducts(parsedParams),
    getCategoryTree(),
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
      category={currentCategory as any}
      isB2B={isB2B}
      productPrices={productPrices}
      searchParams={searchParams}
      allCategories={allCategories}
      useQueryParams={true}
    />
  );
}
