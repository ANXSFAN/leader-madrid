import db from "@/lib/db";
import {
  IS_TYPESENSE_ENABLED,
  indexProduct,
  ensureCollection,
  deleteProductFromIndex as _deleteFromIndex,
} from "./typesense-client";
import { toProductDocument } from "./utils";

export { deleteProductFromIndex } from "./typesense-client";

export async function syncProductToIndex(productId: string) {
  if (!IS_TYPESENSE_ENABLED) return;

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      category: true,
    },
  });

  if (!product) {
    await _deleteFromIndex(productId);
    return;
  }

  // Fetch all categories for path building (needed for toProductDocument)
  // Optimization: We could fetch only parents, but fetching all is simpler and cached by DB usually
  const allCategories = await db.category.findMany();
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  await indexProduct(toProductDocument(product, categoryMap));
}

export async function syncAllProductsToIndex() {
  if (!IS_TYPESENSE_ENABLED) return { synced: 0, error: null };

  try {
    await ensureCollection();

    const allCategories = await db.category.findMany();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    const products = await db.product.findMany({
      include: { variants: true, category: true },
    });

    let synced = 0;
    const batchSize = 10;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (product) => {
          try {
            await indexProduct(toProductDocument(product, categoryMap));
            synced++;
          } catch (e) {
            console.error(`Failed to index product ${product.id}:`, e);
          }
        })
      );
    }

    return { synced, total: products.length, error: null };
  } catch (e: unknown) {
    return { synced: 0, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
