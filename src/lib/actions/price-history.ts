"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";

export interface ProductSearchResult {
  id: string;
  slug: string;
  name: string;
  sku: string;
}

export async function searchProductsForPriceTrends(
  query: string,
  locale: string
): Promise<ProductSearchResult[]> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return [];
  if (!query || query.length < 2) return [];

  const products = await db.product.findMany({
    where: {
      OR: [
        { slug: { contains: query, mode: "insensitive" } },
        { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
      ],
    },
    include: { variants: { select: { sku: true }, take: 1 } },
    take: 20,
  });

  return products.map((p) => {
    const content = p.content as any;
    const name = content?.[locale]?.name || content?.en?.name || p.slug;
    return {
      id: p.id,
      slug: p.slug,
      name,
      sku: p.variants[0]?.sku || p.slug,
    };
  });
}

export interface PriceHistoryPoint {
  date: string;        // "YYYY-MM-DD" format - actual purchase date
  purchasePrice: number | null;
  sellingPrice: number | null;
}

export interface VariantPriceHistory {
  variantId: string;
  sku: string;
  data: PriceHistoryPoint[];
}

export interface SupplierQuote {
  supplierName: string;
  costPrice: number;
}

export interface ProductPriceHistoryData {
  variants: VariantPriceHistory[];
  supplierQuotes: SupplierQuote[];
  currentCostPrice: number | null;
}

export async function getProductPriceHistory(
  productId: string
): Promise<ProductPriceHistoryData> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { variants: [], supplierQuotes: [], currentCostPrice: null };
  // Get all variants for this product
  const variants = await db.productVariant.findMany({
    where: { productId },
    select: { id: true, sku: true, costPrice: true },
  });

  if (variants.length === 0) {
    return { variants: [], supplierQuotes: [], currentCostPrice: null };
  }

  const variantIds = variants.map((v) => v.id);

  // Get all purchase order items ordered by date ASC
  const poItems = await db.purchaseOrderItem.findMany({
    where: {
      variantId: { in: variantIds },
      po: {
        status: { notIn: ["CANCELLED"] },
      },
    },
    select: {
      variantId: true,
      costPrice: true,
      po: { select: { createdAt: true } },
    },
  });

  // Get all sales order items ordered by date ASC
  const soItems = await db.salesOrderItem.findMany({
    where: {
      variantId: { in: variantIds },
      so: {
        status: { notIn: ["CANCELLED"] },
      },
    },
    select: {
      variantId: true,
      unitPrice: true,
      so: { select: { createdAt: true } },
    },
  });

  const formatDate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const formatDateTime = (d: Date): string =>
    `${formatDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

  // Aggregate per variant - only plot price change points
  const result: VariantPriceHistory[] = variants.map((v) => {
    // Each price change becomes a data point with a unique timestamp key
    // We collect all points into a single array, then merge by key
    const pointsMap = new Map<string, { purchasePrice: number | null; sellingPrice: number | null }>();

    // Collect purchase price change points
    let lastPurchasePrice: number | null = null;
    const variantPOItems = poItems
      .filter((item) => item.variantId === v.id)
      .sort((a, b) => a.po.createdAt.getTime() - b.po.createdAt.getTime());

    for (const item of variantPOItems) {
      const price = Number(item.costPrice);
      if (lastPurchasePrice === null || price !== lastPurchasePrice) {
        const key = formatDateTime(item.po.createdAt);
        const existing = pointsMap.get(key) || { purchasePrice: null, sellingPrice: null };
        existing.purchasePrice = price;
        pointsMap.set(key, existing);
        lastPurchasePrice = price;
      }
    }

    // Collect sales price change points
    let lastSalesPrice: number | null = null;
    const variantSOItems = soItems
      .filter((item) => item.variantId === v.id)
      .sort((a, b) => a.so.createdAt.getTime() - b.so.createdAt.getTime());

    for (const item of variantSOItems) {
      const price = Number(item.unitPrice);
      if (lastSalesPrice === null || price !== lastSalesPrice) {
        const key = formatDateTime(item.so.createdAt);
        const existing = pointsMap.get(key) || { purchasePrice: null, sellingPrice: null };
        existing.sellingPrice = price;
        pointsMap.set(key, existing);
        lastSalesPrice = price;
      }
    }

    // Sort by timestamp and build data array (display only date part on x-axis)
    const sortedKeys = Array.from(pointsMap.keys()).sort();
    const data: PriceHistoryPoint[] = sortedKeys.map((key) => {
      const point = pointsMap.get(key)!;
      return {
        date: key.slice(0, 10), // show YYYY-MM-DD on x-axis
        purchasePrice: point.purchasePrice,
        sellingPrice: point.sellingPrice,
      };
    });

    return { variantId: v.id, sku: v.sku, data };
  });

  // Supplier quotes
  const supplierData = await db.productSupplier.findMany({
    where: { productId, costPrice: { not: null } },
    include: { supplier: { select: { name: true } } },
  });

  const supplierQuotes: SupplierQuote[] = supplierData.map((sp) => ({
    supplierName: sp.supplier.name,
    costPrice: Number(sp.costPrice),
  }));

  const currentCostPrice = variants[0]?.costPrice
    ? Number(variants[0].costPrice)
    : null;

  return { variants: result, supplierQuotes, currentCostPrice };
}
