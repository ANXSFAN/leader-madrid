"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductContentJson {
  [locale: string]: { name?: string; description?: string } | string | undefined;
}

export interface InventoryValueItem {
  variantId: string;
  sku: string;
  productName: string;
  stock: number;
  costPrice: number;
  totalValue: number;
}

export interface InventoryValueReport {
  totalValue: number;
  items: InventoryValueItem[];
}

export interface StockMovementByType {
  type: string;
  totalIn: number;
  totalOut: number;
  count: number;
}

export interface TopMovedItem {
  variantId: string;
  sku: string;
  productName: string;
  totalIn: number;
  totalOut: number;
}

export interface StockMovementSummary {
  totalIn: number;
  totalOut: number;
  byType: StockMovementByType[];
  topMovedItems: TopMovedItem[];
}

export interface TurnoverItem {
  variantId: string;
  sku: string;
  productName: string;
  currentStock: number;
  costPrice: number;
  totalOutbound: number;
  turnoverRatio: number;
}

export interface DeadStockItem {
  variantId: string;
  sku: string;
  productName: string;
  stock: number;
  costPrice: number;
  totalValue: number;
  lastMovementDate: Date | null;
}

export interface SupplierPerformanceItem {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  totalPOs: number;
  totalReceived: number;
  avgDaysToReceive: number | null;
  totalAmount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveProductName(content: unknown): string {
  const c = content as ProductContentJson | null;
  if (!c) return "";
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
 * Inventory valuation report.
 * If warehouseId is provided, uses warehouse-level stock; otherwise uses global variant stock.
 */
export async function getInventoryValueReport(
  warehouseId?: string
): Promise<InventoryValueReport | { error: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    if (warehouseId) {
      // Warehouse-specific: join warehouse_stocks with product_variants for costPrice
      const rows = await db.$queryRaw<
        Array<{
          variantId: string;
          sku: string;
          product_content: unknown;
          stock: number;
          costPrice: number;
          totalValue: number;
        }>
      >`
        SELECT
          ws."variantId",
          pv.sku,
          p.content AS product_content,
          ws."physicalStock" AS stock,
          COALESCE(pv."costPrice", 0)::float AS "costPrice",
          (ws."physicalStock" * COALESCE(pv."costPrice", 0))::float AS "totalValue"
        FROM warehouse_stocks ws
        JOIN product_variants pv ON ws."variantId" = pv.id
        JOIN products p ON pv."productId" = p.id
        WHERE ws."warehouseId" = ${warehouseId}
          AND ws."physicalStock" > 0
        ORDER BY (ws."physicalStock" * COALESCE(pv."costPrice", 0)) DESC
      `;

      const items: InventoryValueItem[] = rows.map((r) => ({
        variantId: r.variantId,
        sku: r.sku,
        productName: resolveProductName(r.product_content),
        stock: r.stock,
        costPrice: r.costPrice,
        totalValue: r.totalValue,
      }));

      const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

      return { totalValue, items };
    } else {
      // Global: use variant-level physicalStock
      const rows = await db.$queryRaw<
        Array<{
          variantId: string;
          sku: string;
          product_content: unknown;
          stock: number;
          costPrice: number;
          totalValue: number;
        }>
      >`
        SELECT
          pv.id AS "variantId",
          pv.sku,
          p.content AS product_content,
          pv."physicalStock" AS stock,
          COALESCE(pv."costPrice", 0)::float AS "costPrice",
          (pv."physicalStock" * COALESCE(pv."costPrice", 0))::float AS "totalValue"
        FROM product_variants pv
        JOIN products p ON pv."productId" = p.id
        WHERE pv."physicalStock" > 0
        ORDER BY (pv."physicalStock" * COALESCE(pv."costPrice", 0)) DESC
      `;

      const items: InventoryValueItem[] = rows.map((r) => ({
        variantId: r.variantId,
        sku: r.sku,
        productName: resolveProductName(r.product_content),
        stock: r.stock,
        costPrice: r.costPrice,
        totalValue: r.totalValue,
      }));

      const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);

      return { totalValue, items };
    }
  } catch (error) {
    console.error("getInventoryValueReport error:", error);
    return { error: "Failed to generate inventory value report" };
  }
}

/**
 * Summarize stock movements within a date range, broken down by type and top moved items.
 */
export async function getStockMovementSummary(
  dateFrom: string,
  dateTo: string,
  warehouseId?: string
): Promise<StockMovementSummary | { error: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    const warehouseFilter = warehouseId
      ? `AND it."warehouseId" = $3`
      : "";
    // Build params: $1=fromDate, $2=toDate, $3=warehouseId (optional)
    const params: unknown[] = [fromDate, toDate];
    if (warehouseId) params.push(warehouseId);

    // Totals by type
    const byTypeRows = await db.$queryRawUnsafe<
      Array<{
        type: string;
        totalIn: number;
        totalOut: number;
        count: bigint;
      }>
    >(
      `SELECT
        it.type,
        COALESCE(SUM(CASE WHEN it.quantity > 0 THEN it.quantity ELSE 0 END), 0)::int AS "totalIn",
        COALESCE(SUM(CASE WHEN it.quantity < 0 THEN ABS(it.quantity) ELSE 0 END), 0)::int AS "totalOut",
        COUNT(*)::bigint AS count
      FROM inventory_transactions it
      WHERE it."createdAt" >= $1
        AND it."createdAt" <= $2
        ${warehouseFilter}
      GROUP BY it.type
      ORDER BY count DESC`,
      ...params
    );

    const byType: StockMovementByType[] = byTypeRows.map((r) => ({
      type: r.type,
      totalIn: r.totalIn,
      totalOut: r.totalOut,
      count: Number(r.count),
    }));

    const totalIn = byType.reduce((sum, t) => sum + t.totalIn, 0);
    const totalOut = byType.reduce((sum, t) => sum + t.totalOut, 0);

    // Top moved items (by total absolute quantity)
    const topMovedRows = await db.$queryRawUnsafe<
      Array<{
        variantId: string;
        sku: string;
        product_content: unknown;
        totalIn: number;
        totalOut: number;
      }>
    >(
      `SELECT
        it."variantId",
        pv.sku,
        p.content AS product_content,
        COALESCE(SUM(CASE WHEN it.quantity > 0 THEN it.quantity ELSE 0 END), 0)::int AS "totalIn",
        COALESCE(SUM(CASE WHEN it.quantity < 0 THEN ABS(it.quantity) ELSE 0 END), 0)::int AS "totalOut"
      FROM inventory_transactions it
      JOIN product_variants pv ON it."variantId" = pv.id
      JOIN products p ON pv."productId" = p.id
      WHERE it."createdAt" >= $1
        AND it."createdAt" <= $2
        ${warehouseFilter}
      GROUP BY it."variantId", pv.sku, p.content
      ORDER BY (SUM(ABS(it.quantity))) DESC
      LIMIT 20`,
      ...params
    );

    const topMovedItems: TopMovedItem[] = topMovedRows.map((r) => ({
      variantId: r.variantId,
      sku: r.sku,
      productName: resolveProductName(r.product_content),
      totalIn: r.totalIn,
      totalOut: r.totalOut,
    }));

    return { totalIn, totalOut, byType, topMovedItems };
  } catch (error) {
    console.error("getStockMovementSummary error:", error);
    return { error: "Failed to generate stock movement summary" };
  }
}

/**
 * Inventory turnover report — identifies slow-moving stock.
 * Uses total outbound quantity / average stock as the turnover ratio.
 */
export async function getInventoryTurnoverReport(
  months: number = 6
): Promise<TurnoverItem[] | { error: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);

    const rows = await db.$queryRaw<
      Array<{
        variantId: string;
        sku: string;
        product_content: unknown;
        currentStock: number;
        costPrice: number;
        totalOutbound: number;
      }>
    >`
      SELECT
        pv.id AS "variantId",
        pv.sku,
        p.content AS product_content,
        pv."physicalStock" AS "currentStock",
        COALESCE(pv."costPrice", 0)::float AS "costPrice",
        COALESCE(outbound.total_out, 0)::int AS "totalOutbound"
      FROM product_variants pv
      JOIN products p ON pv."productId" = p.id
      LEFT JOIN (
        SELECT
          it."variantId",
          SUM(ABS(it.quantity)) AS total_out
        FROM inventory_transactions it
        WHERE it.quantity < 0
          AND it."createdAt" >= ${sinceDate}
        GROUP BY it."variantId"
      ) outbound ON outbound."variantId" = pv.id
      WHERE pv."physicalStock" > 0
      ORDER BY pv."physicalStock" DESC
    `;

    const items: TurnoverItem[] = rows.map((r) => {
      // Simplified turnover: outbound qty / current stock
      // (Using current stock as proxy for average stock)
      const turnoverRatio =
        r.currentStock > 0 ? r.totalOutbound / r.currentStock : 0;

      return {
        variantId: r.variantId,
        sku: r.sku,
        productName: resolveProductName(r.product_content),
        currentStock: r.currentStock,
        costPrice: r.costPrice,
        totalOutbound: r.totalOutbound,
        turnoverRatio: Math.round(turnoverRatio * 100) / 100,
      };
    });

    // Sort by turnover ratio ascending (lowest = most stale)
    items.sort((a, b) => a.turnoverRatio - b.turnoverRatio);

    return items;
  } catch (error) {
    console.error("getInventoryTurnoverReport error:", error);
    return { error: "Failed to generate turnover report" };
  }
}

/**
 * Dead stock report — variants with stock > 0 but no movement in N days.
 */
export async function getDeadStockReport(
  daysSinceLastMovement: number = 180
): Promise<{ items: DeadStockItem[] } | { error: string }> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastMovement);

    const rows = await db.$queryRaw<
      Array<{
        variantId: string;
        sku: string;
        product_content: unknown;
        stock: number;
        costPrice: number;
        totalValue: number;
        lastMovementDate: Date | null;
      }>
    >`
      SELECT
        pv.id AS "variantId",
        pv.sku,
        p.content AS product_content,
        pv."physicalStock" AS stock,
        COALESCE(pv."costPrice", 0)::float AS "costPrice",
        (pv."physicalStock" * COALESCE(pv."costPrice", 0))::float AS "totalValue",
        last_move."lastMovementDate"
      FROM product_variants pv
      JOIN products p ON pv."productId" = p.id
      LEFT JOIN (
        SELECT
          it."variantId",
          MAX(it."createdAt") AS "lastMovementDate"
        FROM inventory_transactions it
        GROUP BY it."variantId"
      ) last_move ON last_move."variantId" = pv.id
      WHERE pv."physicalStock" > 0
        AND (
          last_move."lastMovementDate" IS NULL
          OR last_move."lastMovementDate" < ${cutoffDate}
        )
      ORDER BY (pv."physicalStock" * COALESCE(pv."costPrice", 0)) DESC
    `;

    const items: DeadStockItem[] = rows.map((r) => ({
      variantId: r.variantId,
      sku: r.sku,
      productName: resolveProductName(r.product_content),
      stock: r.stock,
      costPrice: r.costPrice,
      totalValue: r.totalValue,
      lastMovementDate: r.lastMovementDate,
    }));

    return { items };
  } catch (error) {
    console.error("getDeadStockReport error:", error);
    return { error: "Failed to generate dead stock report" };
  }
}

/**
 * Supplier performance report — PO stats per supplier.
 */
export async function getSupplierPerformanceReport(): Promise<
  SupplierPerformanceItem[] | { error: string }
> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const rows = await db.$queryRaw<
      Array<{
        supplierId: string;
        supplierName: string;
        supplierCode: string;
        totalPOs: bigint;
        totalReceived: bigint;
        avgDaysToReceive: number | null;
        totalAmount: number;
      }>
    >`
      SELECT
        s.id AS "supplierId",
        s.name AS "supplierName",
        s.code AS "supplierCode",
        COUNT(po.id)::bigint AS "totalPOs",
        COUNT(po.id) FILTER (WHERE po.status = 'RECEIVED')::bigint AS "totalReceived",
        AVG(
          CASE
            WHEN po.status = 'RECEIVED'
            THEN EXTRACT(EPOCH FROM (po."updatedAt" - po."createdAt")) / 86400.0
            ELSE NULL
          END
        )::float AS "avgDaysToReceive",
        COALESCE(SUM(po."totalAmount"), 0)::float AS "totalAmount"
      FROM suppliers s
      JOIN purchase_orders po ON po."supplierId" = s.id
      GROUP BY s.id, s.name, s.code
      ORDER BY COUNT(po.id) DESC
    `;

    return rows.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      supplierCode: r.supplierCode,
      totalPOs: Number(r.totalPOs),
      totalReceived: Number(r.totalReceived),
      avgDaysToReceive: r.avgDaysToReceive
        ? Math.round(r.avgDaysToReceive * 10) / 10
        : null,
      totalAmount: r.totalAmount,
    }));
  } catch (error) {
    console.error("getSupplierPerformanceReport error:", error);
    return { error: "Failed to generate supplier performance report" };
  }
}
