"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { createPurchaseOrder } from "@/lib/actions/purchase-order";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductContentJson {
  [locale: string]: { name?: string; description?: string } | string | undefined;
}

interface SupplierContactJson {
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface ReorderSuggestion {
  variantId: string;
  sku: string;
  productName: string;
  productSlug: string;
  physicalStock: number;
  allocatedStock: number;
  availableStock: number;
  reorderPoint: number;
  minStock: number;
  leadTimeDays: number;
  costPrice: number | null;
  suggestedQty: number;
  primarySupplier: {
    id: string;
    name: string;
    code: string;
    contact: SupplierContactJson | null;
    supplierSku: string | null;
    supplierCostPrice: number | null;
  } | null;
  lastPurchasePrice: number | null;
}

export interface ReorderStats {
  totalBelowReorderPoint: number;
  totalOutOfStock: number;
  totalLowStock: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveProductName(content: unknown): string {
  const c = content as ProductContentJson | null;
  if (!c) return "";
  // Try common locales
  for (const locale of ["en", "es", "de", "fr", "zh"]) {
    const localeData = c[locale];
    if (typeof localeData === "object" && localeData?.name) {
      return localeData.name;
    }
  }
  return "";
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Get all variants that have fallen below their reorder point,
 * enriched with supplier info and suggested order quantities.
 */
export async function getReorderSuggestions(): Promise<
  ReorderSuggestion[] | { error: string }
> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    // Fetch variants below reorder point
    const variants = await db.productVariant.findMany({
      where: {
        reorderPoint: { gt: 0 },
        AND: [
          {
            // available stock <= reorderPoint
            // Prisma doesn't support computed column filters, so we fetch all with reorderPoint > 0
            // and filter in JS
          },
        ],
      },
      select: {
        id: true,
        sku: true,
        physicalStock: true,
        allocatedStock: true,
        reorderPoint: true,
        minStock: true,
        leadTimeDays: true,
        costPrice: true,
        productId: true,
        product: {
          select: {
            content: true,
            slug: true,
            productSuppliers: {
              where: { isPrimary: true },
              take: 1,
              select: {
                supplierSku: true,
                costPrice: true,
                supplier: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    contact: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Filter: available stock <= reorderPoint
    const belowReorder = variants.filter(
      (v) => v.physicalStock - v.allocatedStock <= v.reorderPoint
    );

    if (belowReorder.length === 0) return [];

    // Get last purchase prices for these variants (most recent non-cancelled PO)
    const variantIds = belowReorder.map((v) => v.id);
    const lastPurchasePrices = await db.$queryRaw<
      Array<{ variantId: string; costPrice: number }>
    >`
      SELECT DISTINCT ON (poi."variantId")
        poi."variantId",
        poi."costPrice"::float as "costPrice"
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi."poId" = po.id
      WHERE poi."variantId" = ANY(${variantIds}::text[])
        AND po.status != 'CANCELLED'
      ORDER BY poi."variantId", po."createdAt" DESC
    `;
    const lastPriceMap = new Map(
      lastPurchasePrices.map((lp) => [lp.variantId, lp.costPrice])
    );

    // Build suggestions
    const suggestions: ReorderSuggestion[] = belowReorder.map((v) => {
      const availableStock = v.physicalStock - v.allocatedStock;
      const deficit = v.reorderPoint * 2 - availableStock;
      const suggestedQty = Math.max(deficit, v.minStock, 1);

      const primaryPS = v.product.productSuppliers[0] ?? null;

      return {
        variantId: v.id,
        sku: v.sku,
        productName: resolveProductName(v.product.content),
        productSlug: v.product.slug,
        physicalStock: v.physicalStock,
        allocatedStock: v.allocatedStock,
        availableStock,
        reorderPoint: v.reorderPoint,
        minStock: v.minStock,
        leadTimeDays: v.leadTimeDays,
        costPrice: v.costPrice ? Number(v.costPrice) : null,
        suggestedQty,
        primarySupplier: primaryPS
          ? {
              id: primaryPS.supplier.id,
              name: primaryPS.supplier.name,
              code: primaryPS.supplier.code,
              contact: primaryPS.supplier.contact as SupplierContactJson | null,
              supplierSku: primaryPS.supplierSku,
              supplierCostPrice: primaryPS.costPrice
                ? Number(primaryPS.costPrice)
                : null,
            }
          : null,
        lastPurchasePrice: lastPriceMap.get(v.id) ?? null,
      };
    });

    // Sort by urgency: lowest available stock ratio (available / reorderPoint) first
    suggestions.sort((a, b) => {
      const ratioA =
        a.reorderPoint > 0 ? a.availableStock / a.reorderPoint : 0;
      const ratioB =
        b.reorderPoint > 0 ? b.availableStock / b.reorderPoint : 0;
      return ratioA - ratioB;
    });

    return suggestions;
  } catch (error) {
    console.error("getReorderSuggestions error:", error);
    return { error: "Failed to get reorder suggestions" };
  }
}

/**
 * Convert selected reorder suggestions into a new Purchase Order.
 * Delegates to the existing createPurchaseOrder action.
 */
const convertSuggestionsSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1),
        costPrice: z.number().min(0),
      })
    )
    .min(1, "At least one item is required"),
});

export async function convertSuggestionsToPO(
  data: z.infer<typeof convertSuggestionsSchema>
): Promise<{ success?: boolean; error?: string; poId?: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const validation = convertSuggestionsSchema.safeParse(data);
  if (!validation.success) {
    return { error: "Invalid data: " + validation.error.message };
  }

  // Delegate to the existing PO creation logic
  const result = await createPurchaseOrder(validation.data);

  if ("error" in result && result.error) {
    return { error: result.error };
  }

  if ("po" in result && result.po) {
    return { success: true, poId: result.po.id };
  }

  return { success: true };
}

/**
 * Get summary stats for reorder dashboard cards.
 */
export async function getReorderStats(): Promise<
  ReorderStats | { error: string }
> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const stats = await db.$queryRaw<
      Array<{
        totalBelowReorderPoint: bigint;
        totalOutOfStock: bigint;
        totalLowStock: bigint;
      }>
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE "reorderPoint" > 0
            AND ("physicalStock" - "allocatedStock") <= "reorderPoint"
        ) AS "totalBelowReorderPoint",
        COUNT(*) FILTER (
          WHERE ("physicalStock" - "allocatedStock") <= 0
        ) AS "totalOutOfStock",
        COUNT(*) FILTER (
          WHERE "minStock" > 0
            AND ("physicalStock" - "allocatedStock") <= "minStock"
            AND ("physicalStock" - "allocatedStock") > 0
        ) AS "totalLowStock"
      FROM product_variants
    `;

    const row = stats[0];
    return {
      totalBelowReorderPoint: Number(row.totalBelowReorderPoint),
      totalOutOfStock: Number(row.totalOutOfStock),
      totalLowStock: Number(row.totalLowStock),
    };
  } catch (error) {
    console.error("getReorderStats error:", error);
    return { error: "Failed to get reorder stats" };
  }
}
