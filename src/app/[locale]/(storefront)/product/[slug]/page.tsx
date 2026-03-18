export const revalidate = 604800; // 7 days

import db from "@/lib/db";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { notFound } from "next/navigation";
import { getLocalized } from "@/lib/content";
import { Metadata } from "next";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProductPriceInCurrency } from "@/lib/pricing";
import { getSiteSettings } from "@/lib/actions/config";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import { getTranslations } from "next-intl/server";
import { retrieveProductDocument } from "@/lib/search/typesense-client";
import { getWishlistProductIds } from "@/lib/actions/wishlist";
import { getGlobalAttributes } from "@/lib/actions/attributes";
import { serializeDecimal } from "@/lib/serialize";


const getProduct = cache(async (slug: string) => {
  return await db.product.findUnique({
    where: { slug },
    include: {
      variants: {
        orderBy: { price: "asc" },
      },
      category: true,
      documents: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
});

async function getRelatedProducts(
  categoryId: string | null,
  currentProductId: string
) {
  if (!categoryId) return [];

  return await db.product.findMany({
    where: {
      categoryId,
      id: { not: currentProductId },
      isActive: true,
    },
    take: 4,
    include: {
      variants: {
        orderBy: { price: "asc" },
        take: 1,
      },
      category: true,
    },
  });
}

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string; slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.slug);

  if (!product) {
    const t = await getTranslations({ locale: params.locale, namespace: "common" });
    return { title: t("not_found") };
  }

  const content = getLocalized(product.content, params.locale);
  const productContent = product.content as any;
  const images = Array.isArray(productContent.images)
    ? productContent.images
    : [];
  const ogImage = images.length > 0 ? images[0] : null;

  return {
    title: content.name,
    description:
      content.description?.substring(0, 160) ||
      `Comprar ${content.name} en Leader Madrid.`,
    openGraph: {
      title: content.name,
      description: content.description?.substring(0, 160),
      images: ogImage ? [{ url: ogImage, alt: content.name }] : [],
    },
  };
}

export default async function ProductPage(
  props: {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ variant?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const product = await getProduct(params.slug);
  const session = await getServerSession(authOptions);
  const isB2B = session?.user?.b2bStatus === "APPROVED";

  if (!product) {
    notFound();
  }

  // Resolve display currency
  const displayCurrency = await resolveDisplayCurrency(params.locale);

  // Calculate prices for all variants in display currency
  const priceMap: Record<string, number> = {};
  await Promise.all(
    product.variants.map(async (v) => {
      const result = await getProductPriceInCurrency(
        session?.user?.id,
        v.id,
        displayCurrency
      );
      priceMap[v.id] = result.price;
    })
  );

  const content = getLocalized(product.content, params.locale);
  const productName = content.name;

  const productContent = product.content as any;
  const images = Array.isArray(productContent.images)
    ? productContent.images
    : [];

  const relatedProducts = await getRelatedProducts(
    product.categoryId,
    product.id
  );

  const settings = await getSiteSettings();
  const currency = displayCurrency;

  // Check if product is in user's wishlist
  const wishlistIds = await getWishlistProductIds();
  const isInWishlist = wishlistIds.includes(product.id);

  // Fetch highlight attributes for Quick Specs pills
  const allAttributes = await getGlobalAttributes();
  const highlightAttributes = allAttributes
    .filter((a) => a.isHighlight)
    .map((a) => ({ key: a.key, name: a.name, unit: a.unit }));

  const tsDoc = await retrieveProductDocument(product.id);
  const variantSpecsById: Record<string, any> | null = tsDoc?.variants_json
    ? (() => {
        try {
          const variants = JSON.parse(tsDoc.variants_json) as Array<{
            id?: string;
            specs?: any;
          }>;
          return variants.reduce<Record<string, any>>((acc, v) => {
            if (v?.id) acc[v.id] = v.specs || {};
            return acc;
          }, {});
        } catch {
          return null;
        }
      })()
    : null;

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    image: images,
    description: content.description,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: product.brand || settings.siteName,
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: currency,
      lowPrice: Math.min(...product.variants.map((v) => Number(v.price))),
      highPrice: Math.max(...product.variants.map((v) => Number(v.price))),
      offerCount: product.variants.length,
      offers: product.variants.map((variant) => ({
        "@type": "Offer",
        price: Number(variant.price),
        priceCurrency: currency,
        itemCondition: "https://schema.org/NewCondition",
        availability:
          variant.physicalStock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: `${process.env.NEXT_PUBLIC_APP_URL}/product/${product.slug}?variant=${variant.id}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailView
        product={serializeDecimal(product)}
        isB2B={isB2B}
        priceMap={priceMap}
        relatedProducts={serializeDecimal(relatedProducts)}
        currency={currency}
        variantSpecsById={variantSpecsById}
        isInWishlist={isInWishlist}
        documents={product.documents}
        highlightAttributes={highlightAttributes}
        initialVariantId={searchParams?.variant}
      />
    </>
  );
}
