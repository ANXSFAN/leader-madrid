"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { processStockMovement, releaseAllocatedStock } from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { syncProductToIndex } from "@/lib/search/sync";

// --- Schemas ---

const deliveryOrderItemSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  deliveredQty: z.number().int().min(1, "Delivered quantity must be at least 1"),
});

const createDOSchema = z.object({
  salesOrderId: z.string().min(1, "Sales Order ID is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z
    .array(deliveryOrderItemSchema)
    .min(1, "At least one item is required"),
});

const shipDOSchema = z.object({
  trackingNumber: z.string().optional(),
  carrierName: z.string().optional(),
});

// releaseAllocatedStock is now imported from @/lib/inventory

// --- Helper: revalidate common paths ---

function revalidateDeliveryPaths(doId?: string, soId?: string) {
  revalidatePath("/admin/delivery-orders");
  if (doId) revalidatePath(`/admin/delivery-orders/${doId}`);
  if (soId) {
    revalidatePath(`/admin/sales-orders/${soId}`);
    revalidatePath("/admin/sales-orders");
  }
  revalidatePath("/admin/inventory");
}

// --- Helper: sync affected products to search index ---

async function syncAffectedProducts(variantIds: string[]) {
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { productId: true },
  });
  const productIds = new Set(variants.map((v) => v.productId));
  productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
}

// --- Helper: check if all SO items are fully delivered ---

async function checkSOFullyDelivered(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  salesOrderId: string
): Promise<boolean> {
  const soItems = await tx.salesOrderItem.findMany({
    where: { soId: salesOrderId },
  });

  for (const soItem of soItems) {
    const delivered = await tx.deliveryOrderItem.aggregate({
      where: {
        deliveryOrder: {
          salesOrderId,
          status: { notIn: ["CANCELLED"] },
        },
        variantId: soItem.variantId,
      },
      _sum: { deliveredQty: true },
    });
    const totalDelivered = delivered._sum.deliveredQty ?? 0;
    if (totalDelivered < soItem.quantity) {
      return false;
    }
  }

  return true;
}

// --- Helper: check if all DOs for SO are DELIVERED ---

async function checkAllDOsDelivered(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  salesOrderId: string
): Promise<boolean> {
  const nonDelivered = await tx.deliveryOrder.count({
    where: {
      salesOrderId,
      status: { notIn: ["DELIVERED", "CANCELLED"] },
    },
  });
  return nonDelivered === 0;
}

// =================================================================
// 1. createDeliveryOrder
// =================================================================

export async function createDeliveryOrder(data: z.infer<typeof createDOSchema>) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const result = createDOSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Invalid delivery order data" };
  }

  const { salesOrderId, warehouseId, items } = result.data;

  try {
    const doOrder = await db.$transaction(async (tx) => {
      // Lock the SO row to prevent concurrent DO creation
      const [soRow] = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT id, status FROM sales_orders WHERE id = $1 FOR UPDATE`,
        salesOrderId
      );
      if (!soRow) throw new Error("Sales order not found");
      if (soRow.status !== "CONFIRMED") {
        throw new Error(`Cannot create delivery for SO with status ${soRow.status}. SO must be CONFIRMED.`);
      }

      const so = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { items: true },
      });

      // Build a map of SO items by variantId
      const soItemMap = new Map(so!.items.map((item) => [item.variantId, item]));

      // Get existing delivery quantities per variant for this SO
      const existingDeliveries = await tx.deliveryOrderItem.groupBy({
        by: ["variantId"],
        where: {
          deliveryOrder: {
            salesOrderId,
            status: { notIn: ["CANCELLED"] },
          },
        },
        _sum: { deliveredQty: true },
      });
      const deliveredMap = new Map(
        existingDeliveries.map((d) => [d.variantId, d._sum.deliveredQty ?? 0])
      );

      // Validate each item
      for (const item of items) {
        const soItem = soItemMap.get(item.variantId);
        if (!soItem) {
          throw new Error(`Variant ${item.variantId} is not part of this sales order`);
        }

        const alreadyDelivered = deliveredMap.get(item.variantId) ?? 0;
        const remaining = soItem.quantity - alreadyDelivered;

        if (item.deliveredQty > remaining) {
          throw new Error(
            `Delivered qty (${item.deliveredQty}) exceeds remaining qty (${remaining}) for SKU ${soItem.sku || item.variantId}`
          );
        }
      }

      // Create the Delivery Order
      const created = await tx.deliveryOrder.create({
        data: {
          deliveryNumber: generateOrderNumber("DO"),
          salesOrderId,
          warehouseId,
          status: "DRAFT",
          createdBy: session.user?.id || null,
          items: {
            create: items.map((item) => {
              const soItem = soItemMap.get(item.variantId)!;
              return {
                variantId: item.variantId,
                orderedQty: soItem.quantity,
                deliveredQty: item.deliveredQty,
                sku: soItem.sku || "",
                name: soItem.name || "",
              };
            }),
          },
        },
      });

      return created;
    });

    revalidateDeliveryPaths(doOrder.id, salesOrderId);
    return { success: true, deliveryOrder: doOrder };
  } catch (error: unknown) {
    console.error("Error creating delivery order:", error);
    return { error: error instanceof Error ? error.message : "Failed to create delivery order" };
  }
}

// =================================================================
// 2. confirmDeliveryOrder
// =================================================================

export async function confirmDeliveryOrder(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({ where: { id } });
    if (!doOrder) return { error: "Delivery order not found" };

    if (doOrder.status !== "DRAFT") {
      return { error: `Cannot confirm delivery order with status ${doOrder.status}. Must be DRAFT.` };
    }

    await db.deliveryOrder.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error confirming delivery order:", error);
    return { error: error instanceof Error ? error.message : "Failed to confirm delivery order" };
  }
}

// =================================================================
// 3. startPicking
// =================================================================

export async function startPicking(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({ where: { id } });
    if (!doOrder) return { error: "Delivery order not found" };

    if (doOrder.status !== "CONFIRMED") {
      return { error: `Cannot start picking for delivery order with status ${doOrder.status}. Must be CONFIRMED.` };
    }

    await db.deliveryOrder.update({
      where: { id },
      data: {
        status: "PICKING",
        pickedAt: new Date(),
      },
    });

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error starting picking:", error);
    return { error: error instanceof Error ? error.message : "Failed to start picking" };
  }
}

// =================================================================
// 4. markPacked
// =================================================================

export async function markPacked(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({ where: { id } });
    if (!doOrder) return { error: "Delivery order not found" };

    if (doOrder.status !== "PICKING") {
      return { error: `Cannot mark as packed for delivery order with status ${doOrder.status}. Must be PICKING.` };
    }

    await db.deliveryOrder.update({
      where: { id },
      data: {
        status: "PACKED",
        packedAt: new Date(),
      },
    });

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error marking packed:", error);
    return { error: error instanceof Error ? error.message : "Failed to mark as packed" };
  }
}

// =================================================================
// 5. shipDeliveryOrder
// =================================================================

export async function shipDeliveryOrder(
  id: string,
  shippingData?: z.infer<typeof shipDOSchema>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!doOrder) return { error: "Delivery order not found" };

    if (doOrder.status !== "PACKED") {
      return { error: `Cannot ship delivery order with status ${doOrder.status}. Must be PACKED.` };
    }

    // Verify parent SO is in a valid state for shipping
    const so = await db.salesOrder.findUnique({
      where: { id: doOrder.salesOrderId },
      select: { status: true },
    });
    if (!so || !["CONFIRMED", "SHIPPED"].includes(so.status)) {
      return { error: `Cannot ship: parent Sales Order is not confirmed (status: ${so?.status})` };
    }

    const parsedShipping = shippingData ? shipDOSchema.safeParse(shippingData) : null;
    if (parsedShipping && !parsedShipping.success) {
      return { error: "Invalid shipping data" };
    }

    await db.$transaction(async (tx) => {
      // 1. Update DO status
      await tx.deliveryOrder.update({
        where: { id },
        data: {
          status: "SHIPPED",
          shippedAt: new Date(),
          trackingNumber: parsedShipping?.data?.trackingNumber || null,
          carrierName: parsedShipping?.data?.carrierName || null,
        },
      });

      // 2. For each item: process stock movement (deduct) and release allocated stock
      for (const item of doOrder.items) {
        // Release allocated stock
        await releaseAllocatedStock(tx, {
          variantId: item.variantId,
          quantity: item.deliveredQty,
          warehouseId: doOrder.warehouseId,
        });

        // Deduct physical stock
        await processStockMovement(tx, {
          variantId: item.variantId,
          quantity: -item.deliveredQty,
          type: "SALE_ORDER",
          reference: doOrder.deliveryNumber,
          note: `Shipped via DO ${doOrder.deliveryNumber}`,
          warehouseId: doOrder.warehouseId,
        });
      }

      // 3. Check if all SO items are fully delivered — if so, update SO to SHIPPED
      const fullyDelivered = await checkSOFullyDelivered(tx, doOrder.salesOrderId);
      if (fullyDelivered) {
        await tx.salesOrder.update({
          where: { id: doOrder.salesOrderId },
          data: { status: "SHIPPED" },
        });
      }
    });

    // Sync affected products to search index
    const variantIds = doOrder.items.map((item) => item.variantId);
    await syncAffectedProducts(variantIds);

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error shipping delivery order:", error);
    return { error: error instanceof Error ? error.message : "Failed to ship delivery order" };
  }
}

// =================================================================
// 6. markDelivered
// =================================================================

export async function markDelivered(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({ where: { id } });
    if (!doOrder) return { error: "Delivery order not found" };

    if (doOrder.status !== "SHIPPED") {
      return { error: `Cannot mark as delivered for delivery order with status ${doOrder.status}. Must be SHIPPED.` };
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryOrder.update({
        where: { id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });

      // Check if all DOs for this SO are DELIVERED — if so, update SO to DELIVERED
      const allDelivered = await checkAllDOsDelivered(tx, doOrder.salesOrderId);
      if (allDelivered) {
        await tx.salesOrder.update({
          where: { id: doOrder.salesOrderId },
          data: { status: "DELIVERED" },
        });
      }
    });

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error marking delivered:", error);
    return { error: error instanceof Error ? error.message : "Failed to mark as delivered" };
  }
}

// =================================================================
// 7. cancelDeliveryOrder
// =================================================================

export async function cancelDeliveryOrder(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const doOrder = await db.deliveryOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!doOrder) return { error: "Delivery order not found" };

    // Cannot cancel DELIVERED orders
    if (doOrder.status === "DELIVERED") {
      return { error: "Cannot cancel a delivery order that has already been delivered." };
    }

    if (doOrder.status === "CANCELLED") {
      return { error: "Delivery order is already cancelled." };
    }

    await db.$transaction(async (tx) => {
      // If SHIPPED, we need to reverse stock movements
      if (doOrder.status === "SHIPPED") {
        for (const item of doOrder.items) {
          // Reverse: add stock back (positive quantity)
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: item.deliveredQty,
            type: "SALE_ORDER",
            reference: doOrder.deliveryNumber,
            note: `Stock reversal for cancelled DO ${doOrder.deliveryNumber}`,
            warehouseId: doOrder.warehouseId,
          });
        }
      }

      await tx.deliveryOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    });

    // Sync search index if stock was reversed
    if (doOrder.status === "SHIPPED") {
      const variantIds = doOrder.items.map((item) => item.variantId);
      await syncAffectedProducts(variantIds);
    }

    revalidateDeliveryPaths(id, doOrder.salesOrderId);
    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling delivery order:", error);
    return { error: error instanceof Error ? error.message : "Failed to cancel delivery order" };
  }
}

// =================================================================
// 8. getDeliveryOrders
// =================================================================

export async function getDeliveryOrders(salesOrderId?: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  try {
    const where = salesOrderId ? { salesOrderId } : {};

    const orders = await db.deliveryOrder.findMany({
      where,
      include: {
        salesOrder: {
          select: { id: true, orderNumber: true, status: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: { select: { content: true, slug: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders;
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    return [];
  }
}

// =================================================================
// 9. getDeliveryOrder
// =================================================================

export async function getDeliveryOrder(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  try {
    const doOrder = await db.deliveryOrder.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: {
            customer: {
              select: { id: true, name: true, email: true, companyName: true },
            },
            items: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, slug: true, content: true },
                },
              },
            },
          },
        },
      },
    });

    return doOrder;
  } catch (error) {
    console.error("Error fetching delivery order:", error);
    return null;
  }
}

// =================================================================
// 10. getRemainingDeliveryQty
// =================================================================

export async function getRemainingDeliveryQty(salesOrderId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  try {
    // Get all SO items
    const soItems = await db.salesOrderItem.findMany({
      where: { soId: salesOrderId },
      include: {
        variant: {
          select: { id: true, sku: true },
        },
      },
    });

    // Get already delivered quantities per variant (excluding cancelled DOs)
    const existingDeliveries = await db.deliveryOrderItem.groupBy({
      by: ["variantId"],
      where: {
        deliveryOrder: {
          salesOrderId,
          status: { notIn: ["CANCELLED"] },
        },
      },
      _sum: { deliveredQty: true },
    });
    const deliveredMap = new Map(
      existingDeliveries.map((d) => [d.variantId, d._sum.deliveredQty ?? 0])
    );

    return soItems.map((item) => {
      const deliveredQty = deliveredMap.get(item.variantId) ?? 0;
      return {
        variantId: item.variantId,
        sku: item.sku || item.variant?.sku || "",
        name: item.name || "",
        orderedQty: item.quantity,
        deliveredQty,
        remainingQty: item.quantity - deliveredQty,
      };
    });
  } catch (error) {
    console.error("Error fetching remaining delivery qty:", error);
    return [];
  }
}
