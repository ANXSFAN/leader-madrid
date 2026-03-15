"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { processStockMovement } from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { requireRole } from "@/lib/auth-guard";
import { syncProductToIndex } from "@/lib/search/sync";

// --- Schemas ---

const createPurchaseReturnSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase order is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
        costPrice: z.number().min(0, "Cost price must be non-negative"),
      })
    )
    .min(1, "At least one item is required"),
});

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

// --- Actions ---

/**
 * Create a purchase return in DRAFT status.
 * Validates return qty doesn't exceed received qty for each variant in the PO.
 */
export async function createPurchaseReturn(data: CreatePurchaseReturnInput) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const result = createPurchaseReturnSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Invalid purchase return data" };
  }

  const { purchaseOrderId, warehouseId, reason, items } = result.data;

  try {
    // Validate PO exists and is in a receivable state
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    });

    if (!po) return { error: "Purchase order not found" };

    if (!["RECEIVED", "PARTIAL_RECEIVED"].includes(po.status)) {
      return { error: `Cannot create return for a PO with status ${po.status}. PO must be RECEIVED or PARTIAL_RECEIVED.` };
    }

    // Build received qty per variant from PO items
    const receivedByVariant = new Map<string, number>();
    for (const poItem of po.items) {
      const current = receivedByVariant.get(poItem.variantId) || 0;
      receivedByVariant.set(poItem.variantId, current + poItem.receivedQty);
    }

    // Check existing returns to avoid over-returning
    const existingReturns = await db.purchaseReturn.findMany({
      where: {
        purchaseOrderId,
        status: { notIn: ["CANCELLED"] },
      },
      include: { items: true },
    });

    const alreadyReturnedByVariant = new Map<string, number>();
    for (const ret of existingReturns) {
      for (const retItem of ret.items) {
        const current = alreadyReturnedByVariant.get(retItem.variantId) || 0;
        alreadyReturnedByVariant.set(retItem.variantId, current + retItem.quantity);
      }
    }

    // Validate each item
    for (const item of items) {
      const received = receivedByVariant.get(item.variantId) || 0;
      const alreadyReturned = alreadyReturnedByVariant.get(item.variantId) || 0;
      const maxReturnable = received - alreadyReturned;

      if (item.quantity > maxReturnable) {
        return {
          error: `Cannot return ${item.quantity} of variant ${item.variantId}. Maximum returnable: ${maxReturnable} (received: ${received}, already in returns: ${alreadyReturned}).`,
        };
      }
    }

    // Fetch variant details for snapshot
    const variantIds = items.map((item) => item.variantId);
    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, product: { select: { content: true, slug: true } } },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const totalAmount = items.reduce(
      (acc, item) => acc + item.quantity * item.costPrice,
      0
    );

    const purchaseReturn = await db.purchaseReturn.create({
      data: {
        returnNumber: generateOrderNumber("PR"),
        purchaseOrderId,
        supplierId: po.supplierId,
        warehouseId,
        status: "DRAFT",
        reason: reason || null,
        totalAmount,
        createdBy: session.user?.id || null,
        items: {
          create: items.map((item) => {
            const v = variantMap.get(item.variantId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
            const content = v?.product?.content as any;
            const productName =
              content?.en?.name || content?.es?.name || content?.name || v?.product?.slug || "";
            return {
              variantId: item.variantId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.quantity * item.costPrice,
              reason: reason || null,
              sku: v?.sku || null,
              name: productName || null,
            };
          }),
        },
      },
      include: { items: true },
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-orders/${purchaseOrderId}`);
    return { success: true, purchaseReturn };
  } catch (error: unknown) {
    console.error("Error creating purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to create purchase return" };
  }
}

/**
 * Confirm a DRAFT purchase return.
 * Deducts stock from the warehouse for each item.
 */
export async function confirmPurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const affectedVariantIds: string[] = [];

    await db.$transaction(async (tx) => {
      // Lock the purchase return row to prevent concurrent confirm/cancel
      const [prRow] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; purchaseOrderId: string; warehouseId: string; returnNumber: string }>
      >(
        `SELECT id, status, "purchaseOrderId", "warehouseId", "returnNumber" FROM purchase_returns WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!prRow) throw new Error("Purchase return not found");
      if (prRow.status !== "DRAFT") {
        throw new Error(`Cannot confirm a purchase return with status ${prRow.status}`);
      }

      // Fetch items inside transaction (fresh data)
      const prItems = await tx.purchaseReturnItem.findMany({
        where: { purchaseReturnId: id },
      });

      // Lock PO row and check return qty hasn't been exceeded by other concurrent returns
      const [poRow] = await tx.$queryRawUnsafe<
        Array<{ id: string }>
      >(
        `SELECT id FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        prRow.purchaseOrderId
      );

      if (!poRow) throw new Error("Purchase order not found");

      const poItems = await tx.purchaseOrderItem.findMany({
        where: { poId: prRow.purchaseOrderId },
      });

      const otherActiveReturns = await tx.purchaseReturn.findMany({
        where: {
          purchaseOrderId: prRow.purchaseOrderId,
          status: { notIn: ["CANCELLED"] },
          id: { not: id },
        },
        include: { items: true },
      });

      const receivedByVariant = new Map<string, number>();
      for (const poItem of poItems) {
        receivedByVariant.set(poItem.variantId, (receivedByVariant.get(poItem.variantId) || 0) + poItem.receivedQty);
      }

      const returnedByVariant = new Map<string, number>();
      for (const ret of otherActiveReturns) {
        for (const retItem of ret.items) {
          returnedByVariant.set(retItem.variantId, (returnedByVariant.get(retItem.variantId) || 0) + retItem.quantity);
        }
      }

      for (const item of prItems) {
        const received = receivedByVariant.get(item.variantId) || 0;
        const alreadyReturned = returnedByVariant.get(item.variantId) || 0;
        const maxReturnable = received - alreadyReturned;
        if (item.quantity > maxReturnable) {
          throw new Error(
            `Cannot confirm: return quantity (${item.quantity}) for variant ${item.variantId} exceeds maximum returnable (${maxReturnable})`
          );
        }
      }

      for (const item of prItems) {
        await processStockMovement(tx, {
          variantId: item.variantId,
          quantity: -item.quantity, // Negative = stock OUT
          type: "PURCHASE_RETURN",
          reference: prRow.returnNumber,
          note: `Purchase return ${prRow.returnNumber}`,
          warehouseId: prRow.warehouseId,
        });

        affectedVariantIds.push(item.variantId);
      }

      await tx.purchaseReturn.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-returns/${id}`);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    // Sync search index
    if (affectedVariantIds.length > 0) {
      const variants = await db.productVariant.findMany({
        where: { id: { in: affectedVariantIds } },
        select: { productId: true },
      });
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error confirming purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to confirm purchase return" };
  }
}

/**
 * Mark a CONFIRMED return as shipped to supplier.
 */
export async function shipPurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const pr = await db.purchaseReturn.findUnique({ where: { id } });
    if (!pr) return { error: "Purchase return not found" };
    if (pr.status !== "CONFIRMED") {
      return { error: `Cannot ship a purchase return with status ${pr.status}. Must be CONFIRMED.` };
    }

    await db.purchaseReturn.update({
      where: { id },
      data: { status: "SHIPPED_TO_SUPPLIER" },
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-returns/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error shipping purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to ship purchase return" };
  }
}

/**
 * Mark a SHIPPED_TO_SUPPLIER return as received by supplier.
 */
export async function completePurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const pr = await db.purchaseReturn.findUnique({ where: { id } });
    if (!pr) return { error: "Purchase return not found" };
    if (pr.status !== "SHIPPED_TO_SUPPLIER") {
      return { error: `Cannot complete a purchase return with status ${pr.status}. Must be SHIPPED_TO_SUPPLIER.` };
    }

    await db.purchaseReturn.update({
      where: { id },
      data: { status: "RECEIVED_BY_SUPPLIER" },
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-returns/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error completing purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to complete purchase return" };
  }
}

/**
 * Mark a RECEIVED_BY_SUPPLIER return as refunded.
 */
export async function refundPurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const pr = await db.purchaseReturn.findUnique({ where: { id } });
    if (!pr) return { error: "Purchase return not found" };
    if (pr.status !== "RECEIVED_BY_SUPPLIER") {
      return { error: `Cannot refund a purchase return with status ${pr.status}. Must be RECEIVED_BY_SUPPLIER.` };
    }

    await db.purchaseReturn.update({
      where: { id },
      data: { status: "REFUNDED" },
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-returns/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error refunding purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to refund purchase return" };
  }
}

/**
 * Cancel a purchase return.
 * Only DRAFT or CONFIRMED returns can be cancelled.
 * If CONFIRMED, reverses the stock deduction.
 */
export async function cancelPurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const pr = await db.purchaseReturn.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!pr) return { error: "Purchase return not found" };

    if (!["DRAFT", "CONFIRMED"].includes(pr.status)) {
      return { error: `Cannot cancel a purchase return with status ${pr.status}. Only DRAFT or CONFIRMED returns can be cancelled.` };
    }

    const affectedVariantIds: string[] = [];

    await db.$transaction(async (tx) => {
      // If CONFIRMED, reverse the stock deduction
      if (pr.status === "CONFIRMED") {
        for (const item of pr.items) {
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: item.quantity, // Positive = stock back IN
            type: "PURCHASE_RETURN",
            reference: pr.returnNumber,
            note: `Cancelled purchase return ${pr.returnNumber} — stock reversal`,
            warehouseId: pr.warehouseId,
          });

          affectedVariantIds.push(item.variantId);
        }
      }

      await tx.purchaseReturn.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    });

    revalidatePath("/admin/purchase-returns");
    revalidatePath(`/admin/purchase-returns/${id}`);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    // Sync search index if stock was reversed
    if (affectedVariantIds.length > 0) {
      const variants = await db.productVariant.findMany({
        where: { id: { in: affectedVariantIds } },
        select: { productId: true },
      });
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling purchase return:", error);
    return { error: error instanceof Error ? error.message : "Failed to cancel purchase return" };
  }
}

/**
 * Get list of purchase returns, optionally filtered by PO.
 */
export async function getPurchaseReturns(purchaseOrderId?: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  try {
    const returns = await db.purchaseReturn.findMany({
      where: purchaseOrderId ? { purchaseOrderId } : undefined,
      include: {
        purchaseOrder: { select: { poNumber: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            variant: {
              select: {
                sku: true,
                product: { select: { content: true, slug: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return returns;
  } catch (error) {
    console.error("Error fetching purchase returns:", error);
    return [];
  }
}

/**
 * Get a single purchase return with full details.
 */
export async function getPurchaseReturn(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  try {
    const pr = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: { poNumber: true, supplierId: true, warehouseId: true },
        },
        supplier: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                physicalStock: true,
                product: { select: { content: true, slug: true } },
              },
            },
          },
        },
      },
    });

    return pr;
  } catch (error) {
    console.error("Error fetching purchase return:", error);
    return null;
  }
}
