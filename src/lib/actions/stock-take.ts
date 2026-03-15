"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { processStockMovement } from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { syncProductToIndex } from "@/lib/search/sync";

// --- Schemas ---

const createStockTakeSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  note: z.string().optional(),
  variantIds: z.array(z.string()).optional(),
});

const updateCountSchema = z.object({
  stockTakeId: z.string().min(1),
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      countedQty: z.number().int().min(0, "Counted quantity must be non-negative"),
      note: z.string().optional(),
    })
  ).min(1, "At least one item is required"),
});

// --- 1. Create Stock Take ---

export async function createStockTake(
  data: z.infer<typeof createStockTakeSchema>
): Promise<{ success?: boolean; stockTake?: { id: string }; error?: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = createStockTakeSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    const { warehouseId, note, variantIds } = parsed.data;

    // Verify warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    });
    if (!warehouse) return { error: "Warehouse not found" };

    // Determine which variants to include
    let stockEntries;
    if (variantIds && variantIds.length > 0) {
      // Specific variants: get their current warehouse stock
      stockEntries = await db.warehouseStock.findMany({
        where: {
          warehouseId,
          variantId: { in: variantIds },
        },
        select: { variantId: true, physicalStock: true },
      });

      // Also include requested variants that have no warehouse stock (systemQty = 0)
      const foundVariantIds = new Set(stockEntries.map((s) => s.variantId));
      const missingVariantIds = variantIds.filter((id) => !foundVariantIds.has(id));
      if (missingVariantIds.length > 0) {
        // Verify these variants exist
        const existingVariants = await db.productVariant.findMany({
          where: { id: { in: missingVariantIds } },
          select: { id: true },
        });
        for (const v of existingVariants) {
          stockEntries.push({ variantId: v.id, physicalStock: 0 });
        }
      }
    } else {
      // All variants with stock in this warehouse
      stockEntries = await db.warehouseStock.findMany({
        where: {
          warehouseId,
          OR: [
            { physicalStock: { gt: 0 } },
            { allocatedStock: { gt: 0 } },
          ],
        },
        select: { variantId: true, physicalStock: true },
      });
    }

    if (stockEntries.length === 0) {
      return { error: "No variants found for this warehouse" };
    }

    const stockTakeNumber = generateOrderNumber("COUNT");

    const stockTake = await db.stockTake.create({
      data: {
        stockTakeNumber,
        warehouseId,
        status: "DRAFT",
        note: note || null,
        totalVariants: stockEntries.length,
        createdBy: session.user?.id || null,
        items: {
          create: stockEntries.map((entry) => ({
            variantId: entry.variantId,
            systemQty: entry.physicalStock,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/admin/stock-takes");
    return { success: true, stockTake };
  } catch (error: unknown) {
    console.error("Error creating stock take:", error);
    return { error: "Failed to create stock take" };
  }
}

// --- 2. Start Stock Take ---

export async function startStockTake(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const stockTake = await db.stockTake.findUnique({
      where: { id },
      include: { items: { select: { id: true, variantId: true } } },
    });

    if (!stockTake) return { error: "Stock take not found" };
    if (stockTake.status !== "DRAFT") {
      return { error: `Cannot start stock take with status ${stockTake.status}` };
    }

    // Re-snapshot systemQty for all items in case stock changed since creation
    await db.$transaction(async (tx) => {
      for (const item of stockTake.items) {
        const warehouseStock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: stockTake.warehouseId,
              variantId: item.variantId,
            },
          },
          select: { physicalStock: true },
        });

        await tx.stockTakeItem.update({
          where: { id: item.id },
          data: { systemQty: warehouseStock?.physicalStock ?? 0 },
        });
      }

      await tx.stockTake.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
    });

    revalidatePath("/admin/stock-takes");
    revalidatePath(`/admin/stock-takes/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error starting stock take:", error);
    return { error: "Failed to start stock take" };
  }
}

// --- 3. Update Stock Take Count ---

export async function updateStockTakeCount(
  stockTakeId: string,
  items: Array<{ variantId: string; countedQty: number; note?: string }>
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = updateCountSchema.safeParse({ stockTakeId, items });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    const stockTake = await db.stockTake.findUnique({
      where: { id: stockTakeId },
      select: { id: true, status: true },
    });

    if (!stockTake) return { error: "Stock take not found" };
    if (stockTake.status !== "IN_PROGRESS") {
      return { error: "Stock take must be IN_PROGRESS to record counts" };
    }

    await db.$transaction(async (tx) => {
      for (const item of parsed.data.items) {
        // Get the stock take item to compute discrepancy
        const stockTakeItem = await tx.stockTakeItem.findUnique({
          where: {
            stockTakeId_variantId: {
              stockTakeId,
              variantId: item.variantId,
            },
          },
          select: { id: true, systemQty: true },
        });

        if (!stockTakeItem) {
          throw new Error(`Variant ${item.variantId} not found in this stock take`);
        }

        await tx.stockTakeItem.update({
          where: { id: stockTakeItem.id },
          data: {
            countedQty: item.countedQty,
            discrepancy: item.countedQty - stockTakeItem.systemQty,
            note: item.note || null,
            countedAt: new Date(),
            countedBy: session.user?.id || null,
          },
        });
      }
    });

    revalidatePath(`/admin/stock-takes/${stockTakeId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating stock take count:", error);
    const message = error instanceof Error ? error.message : "Failed to update count";
    return { error: message };
  }
}

// --- 4. Complete Stock Take ---

export async function completeStockTake(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const stockTake = await db.stockTake.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: { select: { id: true, productId: true } },
          },
        },
      },
    });

    if (!stockTake) return { error: "Stock take not found" };
    if (stockTake.status !== "IN_PROGRESS") {
      return { error: "Stock take must be IN_PROGRESS to complete" };
    }

    // Validate all items have been counted
    const uncountedItems = stockTake.items.filter((item) => item.countedQty === null);
    if (uncountedItems.length > 0) {
      return {
        error: `${uncountedItems.length} item(s) have not been counted yet. All items must be counted before completing.`,
      };
    }

    // Warn about high-variance items (>50% off from system qty)
    const highVarianceItems = stockTake.items.filter((item) => {
      if (item.countedQty === null || item.systemQty === 0) return false;
      const variance = Math.abs((item.countedQty - item.systemQty) / item.systemQty);
      return variance > 0.5;
    });

    if (highVarianceItems.length > 0) {
      // Soft check (log only) — ADMIN role is already required and verified above
      console.warn(
        `[StockTake] ${stockTake.stockTakeNumber}: ${highVarianceItems.length} items with >50% variance`
      );
    }

    // Collect unique productIds for search index sync
    const affectedProductIds = new Set<string>();

    await db.$transaction(async (tx) => {
      let discrepancyCount = 0;

      for (const item of stockTake.items) {
        const discrepancy = item.discrepancy ?? 0;

        if (discrepancy !== 0) {
          discrepancyCount++;
          affectedProductIds.add(item.variant.productId);

          // Process stock movement to adjust inventory
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: discrepancy,
            type: "STOCK_TAKE",
            reference: stockTake.stockTakeNumber,
            note: `Stock take adjustment: system=${item.systemQty}, counted=${item.countedQty}`,
            createdBy: session.user?.id,
            warehouseId: stockTake.warehouseId,
          });
        }
      }

      // Update stock take status
      await tx.stockTake.update({
        where: { id },
        data: {
          status: "COMPLETED",
          totalDiscrepancies: discrepancyCount,
          completedAt: new Date(),
          completedBy: session.user?.id || null,
        },
      });
    });

    // Sync affected products to search index (non-blocking)
    for (const productId of affectedProductIds) {
      syncProductToIndex(productId).catch(() => {});
    }

    revalidatePath("/admin/stock-takes");
    revalidatePath(`/admin/stock-takes/${id}`);
    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error completing stock take:", error);
    const message = error instanceof Error ? error.message : "Failed to complete stock take";
    return { error: message };
  }
}

// --- 5. Cancel Stock Take ---

export async function cancelStockTake(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const stockTake = await db.stockTake.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!stockTake) return { error: "Stock take not found" };
    if (stockTake.status === "COMPLETED" || stockTake.status === "CANCELLED") {
      return { error: `Cannot cancel stock take with status ${stockTake.status}` };
    }

    await db.stockTake.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/admin/stock-takes");
    revalidatePath(`/admin/stock-takes/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling stock take:", error);
    return { error: "Failed to cancel stock take" };
  }
}

// --- 6. Get Stock Takes (List) ---

export async function getStockTakes() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  return await db.stockTake.findMany({
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// --- 7. Get Stock Take (Detail) ---

export async function getStockTake(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  return await db.stockTake.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, slug: true, content: true } },
            },
          },
        },
        orderBy: { variant: { sku: "asc" } },
      },
    },
  });
}

// --- 8. Get Stock Take Report ---

export interface StockTakeReportData {
  totalItems: number;
  countedItems: number;
  uncountedItems: number;
  matchItems: number;
  discrepancyItems: number;
  totalPositive: number;
  totalNegative: number;
  netDifference: number;
}

export async function getStockTakeReport(
  id: string
): Promise<StockTakeReportData | { error: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const stockTake = await db.stockTake.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            countedQty: true,
            discrepancy: true,
          },
        },
      },
    });

    if (!stockTake) return { error: "Stock take not found" };

    const totalItems = stockTake.items.length;
    const countedItems = stockTake.items.filter((i) => i.countedQty !== null).length;
    const uncountedItems = totalItems - countedItems;

    let matchItems = 0;
    let discrepancyItems = 0;
    let totalPositive = 0;
    let totalNegative = 0;

    for (const item of stockTake.items) {
      if (item.countedQty === null) continue;

      const disc = item.discrepancy ?? 0;
      if (disc === 0) {
        matchItems++;
      } else {
        discrepancyItems++;
        if (disc > 0) {
          totalPositive += disc;
        } else {
          totalNegative += disc;
        }
      }
    }

    return {
      totalItems,
      countedItems,
      uncountedItems,
      matchItems,
      discrepancyItems,
      totalPositive,
      totalNegative,
      netDifference: totalPositive + totalNegative,
    };
  } catch (error: unknown) {
    console.error("Error generating stock take report:", error);
    return { error: "Failed to generate report" };
  }
}
