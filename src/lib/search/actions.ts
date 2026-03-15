"use server";

import db from "@/lib/db";
import {
  IS_TYPESENSE_ENABLED,
  indexProduct,
  ensureCollection,
} from "./typesense-client";
import { toProductDocument } from "./utils";

export async function syncAllProductsToIndex() {
  "use server";

  if (!IS_TYPESENSE_ENABLED)
    return { synced: 0, error: "Typesense is not enabled" };

  try {
    await ensureCollection();

    // Fetch all categories for path building
    const allCategories = await db.category.findMany();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    const products = await db.product.findMany({
      include: { variants: true, category: true },
    });

    let synced = 0;
    for (const product of products) {
      try {
        await indexProduct(toProductDocument(product, categoryMap));
        synced++;
      } catch (e) {
        console.error(`Failed to index product ${product.id}:`, e);
      }
    }

    return { synced, total: products.length, error: null };
  } catch (e: unknown) {
    return { synced: 0, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
