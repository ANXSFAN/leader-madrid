"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";
import { processStockMovement } from "@/lib/inventory";
import { syncProductToIndex } from "@/lib/search/sync";

/**
 * Get the last purchase price for a variant from PurchaseOrderItem records.
 * Returns the costPrice from the most recent non-cancelled purchase order.
 */
export async function getLastPurchasePrice(variantId: string): Promise<number | null> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const lastItem = await db.purchaseOrderItem.findFirst({
    where: {
      variantId,
      po: { status: { notIn: ["CANCELLED"] } },
    },
    orderBy: { po: { createdAt: "desc" } },
    select: { costPrice: true },
  });

  return lastItem ? Number(lastItem.costPrice) : null;
}

function generateQuickPONumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `QSI-${ts}`;
}

const quickStockInSchema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  reference: z.string().optional(),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1),
        costPrice: z.number().min(0),
      })
    )
    .min(1),
});

export type QuickStockInInput = z.infer<typeof quickStockInSchema>;

export async function createQuickStockIn(input: QuickStockInInput) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = quickStockInSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid data" };

  const { supplierId, warehouseId, reference, note, items } = parsed.data;

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.costPrice,
    0
  );

  const poNumber = reference || generateQuickPONumber();
  const affectedVariantIds: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          warehouseId,
          source: "QUICK",
          status: "RECEIVED",
          totalAmount,
          items: {
            create: items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              total: item.quantity * item.costPrice,
            })),
          },
        },
      });

      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { physicalStock: true, costPrice: true },
        });

        const currentStock = variant?.physicalStock ?? 0;
        const currentCost = Number(variant?.costPrice ?? 0);
        const inQty = item.quantity;
        const inPrice = item.costPrice;

        let newCost: number;
        if (currentStock === 0) {
          newCost = inPrice;
        } else {
          newCost =
            (currentStock * currentCost + inQty * inPrice) /
            (currentStock + inQty);
        }

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            costPrice: Math.round(newCost * 100) / 100,
          },
        });

        await processStockMovement(tx, {
          variantId: item.variantId,
          quantity: inQty,
          type: "PURCHASE_ORDER",
          reference: po.poNumber,
          note: note || `Quick Stock-In ${po.poNumber}`,
          warehouseId,
        });

        affectedVariantIds.push(item.variantId);
      }
    });

    if (affectedVariantIds.length > 0) {
      const variants = await db.productVariant.findMany({
        where: { id: { in: affectedVariantIds } },
        select: { productId: true },
      });
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    revalidatePath("/admin/purchase-stock-in");
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    return { success: true, poNumber };
  } catch (error) {
    console.error("Quick stock-in error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create stock-in",
    };
  }
}

export async function getQuickStockInById(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const po = await db.purchaseOrder.findUnique({
    where: { id, source: "QUICK" },
    include: {
      supplier: { select: { name: true } },
      warehouse: { select: { name: true } },
      items: {
        include: {
          variant: {
            select: {
              sku: true,
              product: { select: { content: true } },
            },
          },
        },
      },
    },
  });

  if (!po) return null;

  // Serialize Decimal fields to plain numbers for RSC boundary
  return {
    ...po,
    totalAmount: Number(po.totalAmount),
    exchangeRate: po.exchangeRate ? Number(po.exchangeRate) : null,
    items: po.items.map((item) => ({
      ...item,
      costPrice: Number(item.costPrice),
      total: Number(item.total),
    })),
  };
}

export async function getQuickStockInRecords(opts?: {
  page?: number;
  pageSize?: number;
}) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { items: [], total: 0, page: 1, pageSize: 20 };

  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;

  const where = { source: "QUICK" };

  const [items, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { name: true } },
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.purchaseOrder.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
