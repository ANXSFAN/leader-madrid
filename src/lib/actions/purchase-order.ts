"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { processStockMovement } from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { requireRole } from "@/lib/auth-guard";
import { syncProductToIndex } from "@/lib/search/sync";

const purchaseOrderItemSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  costPrice: z.number().min(0, "Cost price must be non-negative"),
});

const customsFieldsSchema = z.object({
  customsDeclarationNumber: z.string().optional(),
  customsClearedAt: z.string().optional(),
  dutyAmount: z.number().min(0).optional(),
  customsServiceFee: z.number().min(0).optional(),
  customsNotes: z.string().optional(),
});

const createPOSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one item is required"),
}).merge(customsFieldsSchema);

export async function createPurchaseOrder(data: z.infer<typeof createPOSchema>) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const result = createPOSchema.safeParse(data);

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Invalid purchase order data" };
  }

  const { supplierId, warehouseId, items, customsDeclarationNumber, customsClearedAt, dutyAmount, customsServiceFee, customsNotes } = result.data;

  // Calculate total amount
  const totalAmount = items.reduce(
    (acc, item) => acc + item.quantity * item.costPrice,
    0
  );

  try {
    // Fetch variant sku and product name for snapshot
    const variantIds = items.map((item) => item.variantId);
    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, product: { select: { content: true, slug: true } } },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const po = await db.purchaseOrder.create({
      data: {
        poNumber: generateOrderNumber("PO"),
        supplierId,
        warehouseId,
        totalAmount,
        status: "DRAFT",
        customsDeclarationNumber: customsDeclarationNumber || undefined,
        customsClearedAt: customsClearedAt ? new Date(customsClearedAt) : undefined,
        dutyAmount: dutyAmount ?? undefined,
        customsServiceFee: customsServiceFee ?? undefined,
        customsNotes: customsNotes || undefined,
        items: {
          create: items.map((item) => {
            const v = variantMap.get(item.variantId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
            const content = v?.product?.content as any;
            const productName = content?.en?.name || content?.es?.name || content?.name || v?.product?.slug || "";
            return {
              variantId: item.variantId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.quantity * item.costPrice,
              name: productName,
              sku: v?.sku || "",
            };
          }),
        },
      },
    });

    revalidatePath("/admin/purchase-orders");
    return { success: true, po };
  } catch (error: unknown) {
    console.error("Error creating purchase order:", error);
    return { error: error instanceof Error ? error.message : "Failed to create purchase order" };
  }
}

export async function receivePOItems(
  poId: string,
  items: Array<{ poItemId: string; receiveQty: number }>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  if (!items.length) return { error: "No items to receive" };

  try {
    const affectedVariantIds: string[] = [];

    await db.$transaction(async (tx) => {
      // Lock the PO row to prevent concurrent receives
      const [poRow] = await tx.$queryRawUnsafe<Array<{ id: string; status: string; warehouseId: string | null; poNumber: string }>>(
        `SELECT id, status, "warehouseId", "poNumber" FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        poId
      );
      if (!poRow) throw new Error("Purchase order not found");
      if (!["DRAFT", "SENT", "PARTIAL_RECEIVED"].includes(poRow.status)) {
        throw new Error(`Cannot receive items for a PO with status ${poRow.status}`);
      }
      if (!poRow.warehouseId) {
        throw new Error("Cannot receive PO: no warehouse assigned. Please edit the PO and assign a warehouse first.");
      }

      // Lock PO items
      const poItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
      const poItemMap = new Map(poItems.map((item) => [item.id, item]));

      // Validate all items before processing
      for (const input of items) {
        if (input.receiveQty <= 0) {
          throw new Error("Receive quantity must be greater than 0");
        }
        const poItem = poItemMap.get(input.poItemId);
        if (!poItem) {
          throw new Error(`PO item not found: ${input.poItemId}`);
        }
        const remaining = poItem.quantity - poItem.receivedQty;
        if (input.receiveQty > remaining) {
          throw new Error(
            `Cannot receive ${input.receiveQty} for item ${poItem.sku || poItem.id}. Only ${remaining} remaining (ordered: ${poItem.quantity}, already received: ${poItem.receivedQty}).`
          );
        }
      }

      for (const input of items) {
        const poItem = poItemMap.get(input.poItemId)!;
        const inPrice = Number(poItem.costPrice);

        // Update receivedQty on PO item
        await tx.purchaseOrderItem.update({
          where: { id: input.poItemId },
          data: { receivedQty: { increment: input.receiveQty } },
        });

        // Weighted average cost price
        const variant = await tx.productVariant.findUnique({
          where: { id: poItem.variantId },
          select: { physicalStock: true, costPrice: true },
        });
        const currentStock = variant?.physicalStock ?? 0;
        const currentCost = Number(variant?.costPrice ?? 0);

        let newCost: number;
        if (currentStock === 0) {
          newCost = inPrice;
        } else {
          newCost = (currentStock * currentCost + input.receiveQty * inPrice) / (currentStock + input.receiveQty);
        }

        await tx.productVariant.update({
          where: { id: poItem.variantId },
          data: { costPrice: Math.round(newCost * 100) / 100 },
        });

        // Process stock movement
        await processStockMovement(tx, {
          variantId: poItem.variantId,
          quantity: input.receiveQty,
          type: "PURCHASE_ORDER",
          reference: poRow.poNumber,
          note: `Partial receive PO ${poRow.poNumber}`,
          warehouseId: poRow.warehouseId!,
        });

        affectedVariantIds.push(poItem.variantId);
      }

      // Reload PO items to check if all fully received
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { poId },
      });
      const allReceived = updatedItems.every((item) => item.receivedQty >= item.quantity);

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: allReceived ? "RECEIVED" : "PARTIAL_RECEIVED" },
      });
    });

    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${poId}`);
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
    console.error("Error receiving PO items:", error);
    return { error: error instanceof Error ? error.message : "Failed to receive items" };
  }
}

export async function updatePOStatus(
  id: string,
  status: "DRAFT" | "SENT" | "PARTIAL_RECEIVED" | "RECEIVED" | "CANCELLED"
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    if (po.status === status) {
      return { success: true };
    }

    // Prevent cancelling a RECEIVED or PARTIAL_RECEIVED PO (stock already entered inventory)
    if ((po.status === "RECEIVED" || po.status === "PARTIAL_RECEIVED") && status === "CANCELLED") {
      return { error: "Cannot cancel a purchase order that has already been received (fully or partially). Stock has already been added to inventory." };
    }

    // Enforce approval workflow for high-value POs
    if (status === "SENT" && po.status === "DRAFT") {
      const { requiresApproval } = await import("@/lib/actions/approval");
      const needsApproval = await requiresApproval("PURCHASE_ORDER", { totalAmount: Number(po.totalAmount) });
      if (needsApproval) {
        // Check if there's an approved approval request
        const approval = await db.approvalRequest.findFirst({
          where: {
            entityType: "PURCHASE_ORDER",
            entityId: id,
            status: "APPROVED",
          },
        });
        if (!approval) {
          return {
            error: `This PO (${Number(po.totalAmount).toFixed(2)}) exceeds the approval threshold. Please submit an approval request first.`,
          };
        }
      }
    }

    // Logic for status change
    await db.$transaction(async (tx) => {
      // Update PO status
      await tx.purchaseOrder.update({
        where: { id },
        data: { status },
      });

      // If status becomes RECEIVED, receive all remaining undelivered items
      if (status === "RECEIVED" && po.status !== "RECEIVED") {
        if (!po.warehouseId) {
          throw new Error("Cannot receive PO: no warehouse assigned. Please edit the PO and assign a warehouse first.");
        }

        for (const item of po.items) {
          const remainingQty = item.quantity - item.receivedQty;
          if (remainingQty <= 0) continue; // Already fully received via partial receiving

          // 1. Update Cost Price using weighted average (consistent with quick stock-in)
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { physicalStock: true, costPrice: true },
          });
          const currentStock = variant?.physicalStock ?? 0;
          const currentCost = Number(variant?.costPrice ?? 0);
          const inPrice = Number(item.costPrice);

          let newCost: number;
          if (currentStock === 0) {
            newCost = inPrice;
          } else {
            newCost = (currentStock * currentCost + remainingQty * inPrice) / (currentStock + remainingQty);
          }

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { costPrice: Math.round(newCost * 100) / 100 },
          });

          // 2. Process Stock Movement (only remaining qty)
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: remainingQty,
            type: "PURCHASE_ORDER",
            reference: po.poNumber,
            note: `Received PO ${po.poNumber}`,
            warehouseId: po.warehouseId,
          });

          // 3. Mark item as fully received
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQty: item.quantity },
          });
        }
      }
    });

    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${id}`);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    // Sync affected products to search index after stock/cost changes
    if (status === "RECEIVED") {
      const affectedVariantIds = new Set(
        po.items.map((item) => item.variantId)
      );
      const variants = await db.productVariant.findMany({
        where: { id: { in: [...affectedVariantIds] } },
        select: { productId: true },
      });
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating PO status:", error);
    return { error: error instanceof Error ? error.message : "Failed to update status" };
  }
}

export async function getPurchaseOrders() {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];
  try {
    const pos = await db.purchaseOrder.findMany({
      include: {
        supplier: true,
        warehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return pos;
  } catch (error) {
    console.error("Error fetching POs:", error);
    return [];
  }
}

export async function getPurchaseOrder(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return null;
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
    return po;
  } catch (error) {
    console.error("Error fetching PO:", error);
    return null;
  }
}

export async function updatePurchaseOrderCustoms(
  id: string,
  data: z.infer<typeof customsFieldsSchema>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const result = customsFieldsSchema.safeParse(data);
  if (!result.success) return { error: "Invalid customs data" };

  try {
    await db.purchaseOrder.update({
      where: { id },
      data: {
        customsDeclarationNumber: result.data.customsDeclarationNumber ?? null,
        customsClearedAt: result.data.customsClearedAt ? new Date(result.data.customsClearedAt) : null,
        dutyAmount: result.data.dutyAmount ?? null,
        customsServiceFee: result.data.customsServiceFee ?? null,
        customsNotes: result.data.customsNotes ?? null,
      },
    });

    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating PO customs:", error);
    return { error: error instanceof Error ? error.message : "Failed to update customs info" };
  }
}
