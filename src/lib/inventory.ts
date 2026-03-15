import db from "@/lib/db";
import { InventoryType, Prisma } from "@prisma/client";

/**
 * Syncs global ProductVariant.physicalStock from
 * the SUM of all WarehouseStock records for that variant.
 *
 * NOTE: allocatedStock is NOT synced here — it is managed explicitly
 * by SO confirm/ship/cancel and web order flows, which may allocate
 * at global level without corresponding warehouse-level entries
 * (e.g. web orders, bundle children). Overwriting global allocatedStock
 * from warehouse-level SUM would wipe those allocations.
 */
export async function syncVariantStockFromWarehouses(
  tx: Prisma.TransactionClient,
  variantId: string
) {
  const agg = await tx.warehouseStock.aggregate({
    where: { variantId },
    _sum: {
      physicalStock: true,
    },
  });

  await tx.productVariant.update({
    where: { id: variantId },
    data: {
      physicalStock: agg._sum.physicalStock ?? 0,
    },
  });
}

/**
 * Calculates the available stock for a bundle product based on its components.
 *
 * Logic:
 * 1. Find all components (BundleItem) for the given product.
 * 2. For each component, calculate how many full bundles can be made from its stock.
 *    (available = floor(childStock / quantityNeeded))
 * 3. The bundle stock is the MINIMUM of all component availability.
 *
 * @param productId - The ID of the bundle product
 * @param tx - Optional Prisma Transaction Client (uses default db if not provided)
 * @returns The calculated available stock
 */
export async function getBundleStock(
  productId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || db;

  // 1. Get Bundle Items with child stock
  const bundleItems = await client.bundleItem.findMany({
    where: { parentId: productId },
    include: {
      child: {
        select: { physicalStock: true, allocatedStock: true },
      },
    },
  });

  if (bundleItems.length === 0) {
    return 0; // No components -> No stock
  }

  let minStock = Infinity;

  for (const item of bundleItems) {
    const childStock = item.child.physicalStock - item.child.allocatedStock;
    const needed = item.quantity;

    if (needed <= 0) continue; // Should not happen with min 1 constraint

    const possible = Math.floor(childStock / needed);
    if (possible < minStock) {
      minStock = possible;
    }
  }

  return minStock === Infinity ? 0 : minStock;
}

/**
 * Allocate stock for a variant (increment allocatedStock).
 * Allocates at both warehouse level (if warehouseId provided) and global level.
 * Throws if insufficient available stock.
 */
export async function allocateStock(
  tx: Prisma.TransactionClient,
  data: {
    variantId: string;
    quantity: number;
    warehouseId?: string | null;
  }
) {
  const { variantId, quantity, warehouseId } = data;
  if (quantity <= 0) return;

  // Row-level lock on variant to prevent concurrent over-allocation
  const [lockedVariant] = await tx.$queryRawUnsafe<
    Array<{ id: string; sku: string; physicalStock: number; allocatedStock: number }>
  >(
    `SELECT id, sku, "physicalStock", "allocatedStock" FROM product_variants WHERE id = $1 FOR UPDATE`,
    variantId
  );
  if (!lockedVariant) throw new Error(`Product variant not found: ${variantId}`);

  if (warehouseId) {
    // Lock and validate warehouse-level availability
    const whRows = await tx.$queryRawUnsafe<
      Array<{ id: string; physicalStock: number; allocatedStock: number }>
    >(
      `SELECT id, "physicalStock", "allocatedStock" FROM warehouse_stocks WHERE "warehouseId" = $1 AND "variantId" = $2 FOR UPDATE`,
      warehouseId, variantId
    );
    const whStock = whRows[0];
    const available = (whStock?.physicalStock ?? 0) - (whStock?.allocatedStock ?? 0);
    if (available < quantity) {
      const otherStocks = await tx.warehouseStock.findMany({
        where: {
          variantId,
          warehouseId: { not: warehouseId },
          physicalStock: { gt: 0 },
        },
        include: { warehouse: { select: { name: true } } },
      });
      const hints = otherStocks
        .map((s) => `${s.warehouse.name}: ${s.physicalStock - s.allocatedStock} available`)
        .join(", ");
      const hintMsg = hints ? ` Other warehouses: ${hints}. Consider creating a stock transfer.` : "";
      throw new Error(
        `Insufficient stock for ${lockedVariant.sku} in selected warehouse: available ${available}, requested ${quantity}.${hintMsg}`
      );
    }

    // Allocate at warehouse level
    await tx.warehouseStock.update({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
      data: { allocatedStock: { increment: quantity } },
    });
  } else {
    // Validate global-level availability (already locked above)
    const available = lockedVariant.physicalStock - lockedVariant.allocatedStock;
    if (available < quantity) {
      throw new Error(
        `Insufficient stock for ${lockedVariant.sku}: available ${available}, requested ${quantity}`
      );
    }
  }

  // Allocate at global level
  await tx.productVariant.update({
    where: { id: variantId },
    data: { allocatedStock: { increment: quantity } },
  });
}

/**
 * Release allocated stock for a variant (decrement allocatedStock).
 * Releases at both warehouse level (if warehouseId provided) and global level.
 * Safely caps release to current allocated amount (never goes negative).
 */
export async function releaseAllocatedStock(
  tx: Prisma.TransactionClient,
  data: {
    variantId: string;
    quantity: number;
    warehouseId?: string | null;
  }
) {
  const { variantId, quantity, warehouseId } = data;
  if (quantity <= 0) return;

  // Release at warehouse level
  if (warehouseId) {
    const whStock = await tx.warehouseStock.findUnique({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
    });
    if (whStock && whStock.allocatedStock > 0) {
      const releaseQty = Math.min(whStock.allocatedStock, quantity);
      if (releaseQty > 0) {
        await tx.warehouseStock.update({
          where: {
            warehouseId_variantId: { warehouseId, variantId },
          },
          data: { allocatedStock: { decrement: releaseQty } },
        });
      }
    }
  }

  // Release at global level
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { allocatedStock: true },
  });
  const currentAllocated = Number(variant?.allocatedStock ?? 0);
  if (currentAllocated <= 0) return;

  const releaseQty = Math.min(currentAllocated, quantity);
  if (releaseQty <= 0) return;

  await tx.productVariant.update({
    where: { id: variantId },
    data: { allocatedStock: { decrement: releaseQty } },
  });
}

export async function processStockMovement(
  tx: Prisma.TransactionClient,
  data: {
    variantId: string;
    quantity: number; // Positive for IN, Negative for OUT
    type: InventoryType;
    reference?: string;
    note?: string;
    createdBy?: string;
    warehouseId: string; // Required: every stock movement must specify a warehouse
  }
) {
  const { variantId, quantity, type, reference, note, createdBy, warehouseId } = data;

  // Row-level lock to prevent concurrent stock modifications
  const [variant] = await tx.$queryRawUnsafe<Array<{ id: string; sku: string; productId: string; physicalStock: number; allocatedStock: number }>>(
    `SELECT id, sku, "productId", "physicalStock", "allocatedStock" FROM product_variants WHERE id = $1 FOR UPDATE`,
    variantId
  );

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  // Get product type separately (can't join with FOR UPDATE easily in Prisma raw)
  const product = await tx.product.findUnique({
    where: { id: variant.productId },
    select: { id: true, type: true },
  });

  if (!product) {
    throw new Error(`Product not found for variant: ${variantId}`);
  }

  // 2. Create Transaction for the Main Item (Bundle or Simple)
  await tx.inventoryTransaction.create({
    data: {
      variantId,
      quantity,
      type,
      reference,
      note,
      createdBy,
      warehouseId,
    },
  });

  // 3. Handle Stock Updates
  if (product.type === "BUNDLE") {
    // For Bundles: Don't update the bundle's own stock (it's virtual).
    // Instead, update components and record their transactions.

    const bundleItems = await tx.bundleItem.findMany({
      where: { parentId: product.id },
      include: {
        child: {
          select: { id: true, sku: true },
        },
      },
    });

    // Validate stock before deduction — warehouse-level check
    if (quantity < 0) {
      for (const item of bundleItems) {
        const requiredStock = Math.abs(quantity) * item.quantity;
        const whStock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_variantId: { warehouseId, variantId: item.childId },
          },
        });
        const available = (whStock?.physicalStock ?? 0) - (whStock?.allocatedStock ?? 0);
        if (available < requiredStock) {
          throw new Error(
            `Insufficient stock for bundle component ${item.child.sku} in warehouse (Required: ${requiredStock}, Available: ${available})`
          );
        }
      }
    }

    for (const item of bundleItems) {
      const childChange = quantity * item.quantity;

      // Lock warehouse stock row for bundle component
      await tx.$queryRawUnsafe(
        `SELECT id FROM warehouse_stocks WHERE "warehouseId" = $1 AND "variantId" = $2 FOR UPDATE`,
        warehouseId, item.childId
      );

      // Update warehouse-level stock for each child
      await tx.warehouseStock.upsert({
        where: {
          warehouseId_variantId: { warehouseId, variantId: item.childId },
        },
        update: {
          physicalStock: { increment: childChange },
        },
        create: {
          warehouseId,
          variantId: item.childId,
          physicalStock: Math.max(0, childChange),
        },
      });

      // Sync global stock from warehouses
      await syncVariantStockFromWarehouses(tx, item.childId);

      // Create Transaction for Child
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.childId,
          quantity: childChange,
          type,
          reference,
          note: note
            ? `${note} (Bundle Component)`
            : `Bundle Component of ${variant.sku}`,
          warehouseId,
        },
      });
    }
  } else {
    // For Simple Products: Validate stock before deduction — warehouse-level check
    if (quantity < 0) {
      const requiredStock = Math.abs(quantity);
      const whStock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_variantId: { warehouseId, variantId },
        },
      });
      const available = (whStock?.physicalStock ?? 0) - (whStock?.allocatedStock ?? 0);
      if (available < requiredStock) {
        // Gather other warehouse availability for helpful error
        const otherStocks = await tx.warehouseStock.findMany({
          where: {
            variantId,
            warehouseId: { not: warehouseId },
            physicalStock: { gt: 0 },
          },
          include: {
            warehouse: { select: { name: true } },
          },
        });
        const hints = otherStocks
          .map((s) => `${s.warehouse.name}: ${s.physicalStock - s.allocatedStock} available`)
          .join(", ");
        const hintMsg = hints ? ` Other warehouses: ${hints}` : "";
        throw new Error(
          `Insufficient stock for product ${variant.sku} in selected warehouse (Required: ${requiredStock}, Available: ${available}).${hintMsg}`
        );
      }
    }

    // Lock warehouse stock row
    await tx.$queryRawUnsafe(
      `SELECT id FROM warehouse_stocks WHERE "warehouseId" = $1 AND "variantId" = $2 FOR UPDATE`,
      warehouseId, variantId
    );

    // Update warehouse-level stock
    await tx.warehouseStock.upsert({
      where: {
        warehouseId_variantId: { warehouseId, variantId },
      },
      update: {
        physicalStock: { increment: quantity },
      },
      create: {
        warehouseId,
        variantId,
        physicalStock: Math.max(0, quantity),
      },
    });

    // Sync global stock from all warehouses
    await syncVariantStockFromWarehouses(tx, variantId);
  }
}
