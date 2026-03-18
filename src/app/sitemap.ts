import { MetadataRoute } from "next";
import db from "@/lib/db";

const LOCALES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "zh"] as const;
const DEFAULT_LOCALE = "es";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadermadrid.com";

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      select: { slug: true },
    }),
  ]);

  // Helper: build alternates for a given path segment (e.g. "product/slug")
  function buildAlternates(path: string) {
    return Object.fromEntries(
      LOCALES.map((locale) => [locale, `${baseUrl}/${locale}/${path}`])
    );
  }

  // Homepage — single entry with hreflang alternates
  const homepageUrls: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/${DEFAULT_LOCALE}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 1.0,
    alternates: {
      languages: buildAlternates(""),
    },
  }];

  // Category pages — one entry per category with hreflang alternates
  const categoryUrls: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/${DEFAULT_LOCALE}/category/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
    alternates: {
      languages: buildAlternates(`category/${cat.slug}`),
    },
  }));

  // Product pages — one entry per product with hreflang alternates
  const productUrls: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/${DEFAULT_LOCALE}/product/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
    alternates: {
      languages: buildAlternates(`product/${product.slug}`),
    },
  }));

  return [...homepageUrls, ...categoryUrls, ...productUrls];
}
