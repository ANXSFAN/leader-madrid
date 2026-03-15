"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { processStockMovement } from "@/lib/inventory";
import { requireRole } from "@/lib/auth-guard";
import { sendLowStockAlertEmail } from "@/lib/email";
import { syncProductToIndex } from "@/lib/search/sync";

export async function triggerLowStockAlert(): Promise<{ sent: number } | { error: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const variants = await db.$queryRaw<Array<{
      sku: string;
      product_name: string;
      physicalStock: number;
      allocatedStock: number;
      availableStock: number;
      minStock: number;
    }>>`
      SELECT pv.sku, pv."physicalStock", pv."allocatedStock",
        (pv."physicalStock" - pv."allocatedStock") as "availableStock",
        pv."minStock",
        COALESCE(p.content->'es'->>'name', p.content->'en'->>'name', pv.sku) as product_name
      FROM product_variants pv
      JOIN products p ON pv."productId" = p.id
      WHERE (pv."physicalStock" - pv."allocatedStock") <= pv."minStock"
      ORDER BY (pv."physicalStock" - pv."allocatedStock") ASC
    `;

    if (variants.length === 0) return { sent: 0 };

    await sendLowStockAlertEmail(
      variants.map((v) => ({
        sku: v.sku,
        productName: v.product_name,
        physicalStock: v.physicalStock,
        minStock: v.minStock,
      }))
    );

    return { sent: variants.length };
  } catch (error) {
    console.error("triggerLowStockAlert error:", error);
    return { error: "Failed to send low stock alert" };
  }
}

const adjustStockSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number(),
  type: z.enum([
    "PURCHASE_ORDER",
    "SALE_ORDER",
    "ADJUSTMENT",
    "RETURN",
    "DAMAGED",
  ]),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export async function adjustStock(
  variantId: string,
  quantity: number,
  type: "PURCHASE_ORDER" | "SALE_ORDER" | "ADJUSTMENT" | "RETURN" | "DAMAGED",
  reference?: string,
  note?: string,
  warehouseId?: string
): Promise<{ success?: boolean; error?: string; otherWarehouses?: { warehouseId: string; name: string; available: number }[] }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  if (!warehouseId) {
    return { error: "Warehouse is required for stock adjustments" };
  }

  const result = adjustStockSchema.safeParse({
    variantId,
    warehouseId,
    quantity,
    type,
    reference,
    note,
  });

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Datos de ajuste de inventario inválidos" };
  }

  try {
    await db.$transaction(async (tx) => {
      await processStockMovement(tx, {
        variantId,
        quantity,
        type,
        reference: reference || "MANUAL_ADJ",
        note,
        createdBy: session.user?.id,
        warehouseId,
      });
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    // Sync affected product to search index after stock change
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true },
    });
    if (variant) {
      syncProductToIndex(variant.productId).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    console.error("Inventory adjustment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to adjust stock";

    // If it's an insufficient stock error, provide other warehouse info
    if (errorMessage.includes("Insufficient stock")) {
      const otherStocks = await db.warehouseStock.findMany({
        where: {
          variantId,
          warehouseId: { not: warehouseId },
          physicalStock: { gt: 0 },
        },
        include: {
          warehouse: { select: { id: true, name: true } },
        },
      });
      return {
        error: errorMessage,
        otherWarehouses: otherStocks.map((s) => ({
          warehouseId: s.warehouse.id,
          name: s.warehouse.name,
          available: s.physicalStock - s.allocatedStock,
        })),
      };
    }

    return { error: errorMessage };
  }
}
