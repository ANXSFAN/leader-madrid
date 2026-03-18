import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveBanners } from "@/lib/actions/cms";
import { getBatchProductPricesInCurrency } from "@/lib/pricing";
import { HomeView } from "@/components/storefront/home-view";
import { getSiteSettings } from "@/lib/actions/config";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import { getGlobalAttributes } from "@/lib/actions/attributes";
import { serializeDecimal } from "@/lib/serialize";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const settings = await getSiteSettings();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadermadrid.com";

  return {
    title: {
      absolute: `${settings.siteName} | Iluminación LED Profesional`,
    },
    description: "Distribuidor mayorista de iluminación LED en Madrid. Calidad profesional a precios competitivos.",
    openGraph: {
      title: `${settings.siteName} | Iluminación LED Profesional`,
      description: "Distribuidor mayorista de iluminación LED en Madrid. Calidad profesional a precios competitivos.",
      url: appUrl,
      siteName: settings.siteName,
      locale: params.locale,
      type: "website",
    },
    alternates: {
      canonical: appUrl,
    },
  };
}

async function getFeaturedProducts() {
  return await db.product.findMany({
    where: {
      isFeatured: true,
      isActive: true,
    },
    take: 8,
    include: {
      category: true,
      variants: {
        orderBy: { price: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export default async function Home(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const [products, session, banners, settings, displayCurrency, allAttributes, l1Categories] = await Promise.all([
    getFeaturedProducts(),
    getServerSession(authOptions),
    getActiveBanners(),
    getSiteSettings(),
    resolveDisplayCurrency(params.locale),
    getGlobalAttributes(),
    db.category.findMany({
      where: { parentId: null },
      orderBy: { slug: "asc" },
      take: 4,
    }),
  ]);

  const highlightAttributes = allAttributes
    .filter((a) => a.isHighlight)
    .map((a) => ({ key: a.key, name: a.name, unit: a.unit }));
  const isB2B = session?.user?.b2bStatus === "APPROVED";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadermadrid.com";

  // Calculate prices for each product (first variant) in display currency
  const productPrices: Record<string, number> = {};
  const variantIds: string[] = [];
  const productVariantMap: Record<string, string> = {}; // variantId -> productId

  products.forEach((p) => {
    if (p.variants.length > 0) {
      const vId = p.variants[0].id;
      variantIds.push(vId);
      productVariantMap[vId] = p.id;
    }
  });

  if (variantIds.length > 0) {
    const batchPrices = await getBatchProductPricesInCurrency(
      session?.user?.id,
      variantIds,
      displayCurrency
    );

    // Map back to productId
    Object.entries(batchPrices).forEach(([vId, price]) => {
      const pId = productVariantMap[vId];
      if (pId) {
        productPrices[pId] = price;
      }
    });
  }

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName,
    url: appUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${appUrl}/${params.locale}/search?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName,
    url: appUrl,
    contactPoint: settings.contactEmail
      ? {
          "@type": "ContactPoint",
          email: settings.contactEmail,
          contactType: "customer service",
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HomeView
        featuredProducts={serializeDecimal(products)}
        banners={banners}
        isB2B={isB2B}
        productPrices={productPrices}
        currency={displayCurrency}
        highlightAttributes={highlightAttributes}
        categories={l1Categories}
      />
    </>
  );
}
