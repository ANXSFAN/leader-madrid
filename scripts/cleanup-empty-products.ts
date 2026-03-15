/**
 * Cleanup script: Remove "Untitled" / empty products from the database.
 *
 * These products have no meaningful name in any locale inside their `content` JSONB field.
 * They were likely created by the (now-deleted) /api/test-inventory route or incomplete imports.
 *
 * Usage:  npx tsx scripts/cleanup-empty-products.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SUPPORTED_LOCALES = ["es", "en", "zh", "fr", "de", "it", "pt", "nl", "pl"];

function hasValidName(content: any): boolean {
  if (!content || typeof content !== "object") return false;

  // Check locale-based structure: { en: { name: "..." }, es: { name: "..." } }
  for (const locale of SUPPORTED_LOCALES) {
    const loc = content[locale];
    if (loc && typeof loc === "object" && typeof loc.name === "string" && loc.name.trim().length > 0) {
      return true;
    }
  }

  // Check flat structure: { name: "..." } (used by test-inventory)
  if (typeof content.name === "string" && content.name.trim().length > 0) {
    // Flat structure is invalid for getLocalized(), still counts as empty
    // unless the name is meaningful (not "Test Product A" etc.)
    // But since these are test artifacts, treat them as invalid too
    return false;
  }

  return false;
}

async function main() {
  console.log("Scanning for empty/untitled products...\n");

  const allProducts = await db.product.findMany({
    select: { id: true, slug: true, sku: true, content: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const emptyProducts = allProducts.filter((p) => !hasValidName(p.content));

  if (emptyProducts.length === 0) {
    console.log("No empty products found. Database is clean!");
    return;
  }

  console.log(`Found ${emptyProducts.length} empty/untitled products:\n`);
  for (const p of emptyProducts) {
    console.log(`  - [${p.sku}] slug="${p.slug}" created=${p.createdAt.toISOString()}`);
  }

  console.log(`\nDeleting ${emptyProducts.length} products and their related data...`);

  const ids = emptyProducts.map((p) => p.id);

  // Delete in correct order to respect foreign key constraints
  await db.$transaction(async (tx) => {
    // Delete related records first
    await tx.bundleItem.deleteMany({ where: { OR: [{ parentId: { in: ids } }, { child: { productId: { in: ids } } }] } });
    await tx.inventoryTransaction.deleteMany({ where: { variant: { productId: { in: ids } } } });
    await tx.cartItem.deleteMany({ where: { variant: { productId: { in: ids } } } });
    await tx.wishlistItem.deleteMany({ where: { productId: { in: ids } } });
    await tx.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await tx.productSupplier.deleteMany({ where: { productId: { in: ids } } });
    await tx.productDocument.deleteMany({ where: { productId: { in: ids } } });
    await tx.product.deleteMany({ where: { id: { in: ids } } });
  });

  console.log(`\nDone! Deleted ${emptyProducts.length} empty products.`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
