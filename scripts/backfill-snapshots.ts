/**
 * 回填脚本：为已有订单/发票/退货记录补充产品快照字段
 *
 * 用法：
 *   npx tsx scripts/backfill-snapshots.ts
 *
 * 前置条件：
 *   - .env 里已配好 DATABASE_URL / DIRECT_URL
 *   - 已执行 20260304000000_add_product_snapshots 迁移
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

function getProductName(content: any): string {
  if (!content) return "";
  const name = content?.en?.name || content?.es?.name || content?.name;
  return typeof name === "string" ? name : "";
}

function getProductImage(content: any): string | null {
  if (!content) return null;
  const images = content?.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }
  return null;
}

async function backfillOrderItems() {
  console.log("\n=== OrderItem: backfilling image ===");
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const items = await prisma.orderItem.findMany({
      where: { image: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        variant: {
          select: { product: { select: { content: true } } },
        },
      },
    });

    if (items.length === 0) break;

    for (const item of items) {
      const image = getProductImage(item.variant.product.content);
      if (image) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { image },
        });
        updated++;
      }
    }

    cursor = items[items.length - 1].id;
    console.log(`  processed ${updated} OrderItems so far...`);
  }

  console.log(`  Done: updated ${updated} OrderItems`);
}

async function backfillSalesOrderItems() {
  console.log("\n=== SalesOrderItem: backfilling name, sku, image ===");
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const items = await prisma.salesOrderItem.findMany({
      where: { name: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        variant: {
          select: {
            sku: true,
            product: { select: { content: true, slug: true } },
          },
        },
      },
    });

    if (items.length === 0) break;

    for (const item of items) {
      const name = getProductName(item.variant.product.content) || item.variant.product.slug;
      const sku = item.variant.sku;
      const image = getProductImage(item.variant.product.content);

      await prisma.salesOrderItem.update({
        where: { id: item.id },
        data: { name, sku, image },
      });
      updated++;
    }

    cursor = items[items.length - 1].id;
    console.log(`  processed ${updated} SalesOrderItems so far...`);
  }

  console.log(`  Done: updated ${updated} SalesOrderItems`);
}

async function backfillPurchaseOrderItems() {
  console.log("\n=== PurchaseOrderItem: backfilling name, sku ===");
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const items = await prisma.purchaseOrderItem.findMany({
      where: { name: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        variant: {
          select: {
            sku: true,
            product: { select: { content: true, slug: true } },
          },
        },
      },
    });

    if (items.length === 0) break;

    for (const item of items) {
      const name = getProductName(item.variant.product.content) || item.variant.product.slug;
      const sku = item.variant.sku;

      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { name, sku },
      });
      updated++;
    }

    cursor = items[items.length - 1].id;
    console.log(`  processed ${updated} PurchaseOrderItems so far...`);
  }

  console.log(`  Done: updated ${updated} PurchaseOrderItems`);
}

async function backfillReturnItems() {
  console.log("\n=== ReturnItem: backfilling name, sku, image ===");
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const items = await prisma.returnItem.findMany({
      where: { name: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        variant: {
          select: {
            sku: true,
            product: { select: { content: true, slug: true } },
          },
        },
      },
    });

    if (items.length === 0) break;

    for (const item of items) {
      const name = getProductName(item.variant.product.content) || item.variant.product.slug;
      const sku = item.variant.sku;
      const image = getProductImage(item.variant.product.content);

      await prisma.returnItem.update({
        where: { id: item.id },
        data: { name, sku, image },
      });
      updated++;
    }

    cursor = items[items.length - 1].id;
    console.log(`  processed ${updated} ReturnItems so far...`);
  }

  console.log(`  Done: updated ${updated} ReturnItems`);
}

async function main() {
  console.log("Starting product snapshot backfill...");

  await backfillOrderItems();
  await backfillSalesOrderItems();
  await backfillPurchaseOrderItems();
  await backfillReturnItems();

  console.log("\nBackfill complete!");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
