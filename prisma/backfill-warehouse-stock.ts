/**
 * Data Backfill Script: Create WarehouseStock records for all ProductVariants
 * pointing to the default warehouse.
 *
 * Run with: npx tsx prisma/backfill-warehouse-stock.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Find default warehouse
  const defaultWarehouse = await db.warehouse.findFirst({
    where: { isDefault: true },
  });

  if (!defaultWarehouse) {
    console.error("No default warehouse found. Please create one first.");
    process.exit(1);
  }

  console.log(`Default warehouse: ${defaultWarehouse.name} (${defaultWarehouse.id})`);

  // 2. Get all product variants
  const variants = await db.productVariant.findMany({
    select: { id: true, physicalStock: true, allocatedStock: true },
  });

  console.log(`Found ${variants.length} product variants`);

  let created = 0;
  let skipped = 0;

  for (const variant of variants) {
    // Check if WarehouseStock already exists
    const existing = await db.warehouseStock.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: defaultWarehouse.id,
          variantId: variant.id,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await db.warehouseStock.create({
      data: {
        warehouseId: defaultWarehouse.id,
        variantId: variant.id,
        physicalStock: variant.physicalStock,
        allocatedStock: variant.allocatedStock,
      },
    });
    created++;
  }

  console.log(`Done. Created: ${created}, Skipped (already existed): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
