"use server";

import db from "@/lib/db";
import { getLocalized } from "@/lib/content";
import {
  IS_TYPESENSE_ENABLED,
  suggestProducts as tsSuggestProducts,
} from "@/lib/search/typesense-client";
import { unstable_cache } from "next/cache";

export type SearchSuggestion = {
  id: string;
  text: string;
  type: "product" | "category" | "history";
  slug?: string;
};

export async function getSearchSuggestions(
  query: string,
  locale: string = "en"
): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return [];

  const suggestions: SearchSuggestion[] = [];

  if (IS_TYPESENSE_ENABLED) {
    try {
      const tsHits = await tsSuggestProducts(query, 5);
      tsHits.forEach((h) => {
        suggestions.push({
          id: h.id,
          text: h.name,
          type: "product",
          slug: h.slug,
        });
      });
      return suggestions.slice(0, 8);
    } catch {
      // fall through to DB
    }
  }

  const categories = await db.category.findMany({
    where: {
      OR: [
        { slug: { contains: query, mode: "insensitive" } },
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
    take: 3,
  });

  categories.forEach((cat) => {
    const content = getLocalized(cat.content, locale);
    suggestions.push({
      id: cat.id,
      text: content.name,
      type: "category",
      slug: cat.slug,
    });
  });

  const products = await db.product.findMany({
    where: {
      OR: [
        { slug: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
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
      isActive: true,
    },
    take: 5,
    select: {
      id: true,
      slug: true,
      sku: true,
      content: true,
    },
  });

  products.forEach((p) => {
    const content = getLocalized(p.content, locale);
    suggestions.push({
      id: p.id,
      text: content.name,
      type: "product",
      slug: p.slug,
    });
  });

  return suggestions.slice(0, 8);
}

export type FeaturedSearchTerm = {
  name: string;
  slug: string;
};

const _getFeaturedSearchTerms = async (
  locale: string
): Promise<FeaturedSearchTerm[]> => {
  const products = await db.product.findMany({
    where: { isFeatured: true, isActive: true },
    take: 6,
    orderBy: { updatedAt: "desc" },
    select: { slug: true, content: true },
  });

  return products.map((p) => {
    const content = getLocalized(p.content, locale);
    return { name: content.name, slug: p.slug };
  });
};

export const getFeaturedSearchTerms = async (
  locale: string
): Promise<FeaturedSearchTerm[]> => {
  const cached = unstable_cache(
    () => _getFeaturedSearchTerms(locale),
    [`featured-search-terms-${locale}`],
    { revalidate: 3600, tags: ["products"] }
  );
  return cached();
};
