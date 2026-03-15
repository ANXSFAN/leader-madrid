import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { ExportReportButton } from "@/components/admin/export-report-button";
import { DateRange, getMonthlyBuckets, getMonthKey, formatPercent } from "@/lib/report-utils";
import { InventoryMovementChart, ABCClassificationChart } from "./inventory-charts-client";

export async function InventoryReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  const [
    totalVariants,
    outOfStock,
    lowStockRaw,
    topSold,
    costValue,
    outOfStockVariants,
    inventoryTransactions,
  ] = await Promise.all([
    db.productVariant.count({ where: { product: { isActive: true } } }),
    db.productVariant.count({
      where: { physicalStock: 0, product: { isActive: true } },
    }),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM product_variants pv
      JOIN products p ON pv."productId" = p.id
      WHERE pv."physicalStock" > 0 AND pv."physicalStock" <= pv."minStock" AND p."isActive" = true
    `,
    db.orderItem.groupBy({
      by: ["variantId", "sku"],
      _sum: { quantity: true },
      where: {
        order: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
          status: { notIn: ["CANCELLED"] },
        },
      },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    db.productVariant.findMany({
      where: { physicalStock: { gt: 0 }, costPrice: { gt: 0 } },
      select: { physicalStock: true, costPrice: true },
    }),
    db.productVariant.findMany({
      where: { physicalStock: 0, product: { isActive: true } },
      include: { product: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    db.inventoryTransaction.findMany({
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
      select: { quantity: true, type: true, createdAt: true },
    }),
  ]);

  const lowStock = Number(lowStockRaw[0]?.count ?? 0);
  const totalInventoryValue = costValue.reduce(
    (sum, v) => sum + v.physicalStock * Number(v.costPrice ?? 0),
    0
  );
  const totalStock = costValue.reduce((sum, v) => sum + v.physicalStock, 0);

  // Inventory movement chart (monthly in/out)
  const movementMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ in: 0, out: 0 }));
  for (const tx of inventoryTransactions) {
    const mk = getMonthKey(tx.createdAt);
    if (movementMap.has(mk)) {
      const bucket = movementMap.get(mk)!;
      if (tx.quantity > 0) bucket.in += tx.quantity;
      else bucket.out += Math.abs(tx.quantity);
    }
  }
  const movementChart = Array.from(movementMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return { name: label, in: val.in, out: val.out };
  });

  // Inventory Turnover = COGS (units sold * cost) / avg inventory value
  const soldItems = await db.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { notIn: ["CANCELLED"] },
      },
      costPrice: { not: null },
    },
    select: { quantity: true, costPrice: true },
  });
  const cogs = soldItems.reduce((s, item) => s + item.quantity * Number(item.costPrice ?? 0), 0);
  const turnoverRate = totalInventoryValue > 0 ? cogs / totalInventoryValue : 0;

  // ABC Classification: by inventory value (stock * costPrice), sorted desc
  const allVariantsForABC = await db.productVariant.findMany({
    where: { physicalStock: { gt: 0 }, costPrice: { gt: 0 }, product: { isActive: true } },
    select: { id: true, sku: true, physicalStock: true, costPrice: true, product: { select: { content: true } } },
    orderBy: { physicalStock: "desc" },
  });

  const abcItems = allVariantsForABC
    .map((v) => {
      const value = v.physicalStock * Number(v.costPrice);
      const content = v.product.content as Record<string, Record<string, string>> | null;
      const name = content?.en?.name || content?.es?.name || v.sku;
      return { id: v.id, name, sku: v.sku, value, stock: v.physicalStock };
    })
    .sort((a, b) => b.value - a.value);

  const totalABCValue = abcItems.reduce((s, i) => s + i.value, 0);
  let cumValue = 0;
  const abcClassified = abcItems.map((item) => {
    cumValue += item.value;
    const cumPct = totalABCValue > 0 ? (cumValue / totalABCValue) * 100 : 0;
    const category = cumPct <= 80 ? "A" as const : cumPct <= 95 ? "B" as const : "C" as const;
    return { ...item, category };
  });

  const abcChartData = abcClassified.map((item) => ({
    name: item.sku,
    value: Math.round(item.value * 100) / 100,
    category: item.category,
  }));

  const abcSummary = {
    A: abcClassified.filter((i) => i.category === "A").length,
    B: abcClassified.filter((i) => i.category === "B").length,
    C: abcClassified.filter((i) => i.category === "C").length,
  };

  // Dead stock: items with stock but no sales in last 90 days
  const ninetyDaysAgo = new Date(dateRange.to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentSoldVariantIds = await db.orderItem.groupBy({
    by: ["variantId"],
    where: {
      order: { createdAt: { gte: ninetyDaysAgo }, status: { notIn: ["CANCELLED"] } },
    },
  });
  const soldVariantIdSet = new Set(recentSoldVariantIds.map((r) => r.variantId));

  const deadStockItems = allVariantsForABC
    .filter((v) => !soldVariantIdSet.has(v.id))
    .slice(0, 10)
    .map((v) => {
      const content = v.product.content as Record<string, Record<string, string>> | null;
      const name = content?.en?.name || content?.es?.name || v.sku;
      return { sku: v.sku, name, stock: v.physicalStock, value: v.physicalStock * Number(v.costPrice) };
    });

  // Restock suggestions: daily avg sales * 14 days vs current stock
  const dayRange = Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)));
  const salesByVariant = await db.orderItem.groupBy({
    by: ["variantId", "sku"],
    _sum: { quantity: true },
    where: {
      order: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { notIn: ["CANCELLED"] },
      },
    },
  });

  const variantStockMap = new Map(
    allVariantsForABC.map((v) => [v.id, v.physicalStock])
  );

  const restockSuggestions = salesByVariant
    .map((s) => {
      const totalSold = Number(s._sum.quantity ?? 0);
      const dailyAvg = totalSold / dayRange;
      const needed = Math.ceil(dailyAvg * 14);
      const currentStock = variantStockMap.get(s.variantId) ?? 0;
      return { sku: s.sku, dailyAvg: Math.round(dailyAvg * 10) / 10, needed, currentStock, deficit: needed - currentStock };
    })
    .filter((s) => s.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 10);

  // Movement by type summary
  const movementByType = new Map<string, { in: number; out: number }>();
  for (const tx of inventoryTransactions) {
    if (!movementByType.has(tx.type)) {
      movementByType.set(tx.type, { in: 0, out: 0 });
    }
    const bucket = movementByType.get(tx.type)!;
    if (tx.quantity > 0) bucket.in += tx.quantity;
    else bucket.out += Math.abs(tx.quantity);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportReportButton type="inventory" dateRange={dateRange} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">
              {t("inventory.variants")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalVariants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">
              {t("inventory.out_of_stock")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${outOfStock > 0 ? "text-red-600" : "text-green-600"}`}>
              {outOfStock}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">
              {t("inventory.turnover_rate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{turnoverRate.toFixed(2)}x</p>
            <p className="text-xs text-muted-foreground">COGS / {t("inventory.avg_value")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">
              {t("inventory.inventory_value")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalInventoryValue, { locale, currency })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("inventory.units_suffix", { count: totalStock.toLocaleString() })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Movement */}
      <Card>
        <CardHeader>
          <CardTitle>{t("inventory.movement_chart")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryMovementChart data={movementChart} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ABC Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.abc_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">A: {abcSummary.A} {t("inventory.items")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs">B: {abcSummary.B} {t("inventory.items")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">C: {abcSummary.C} {t("inventory.items")}</span>
              </div>
            </div>
            <ABCClassificationChart data={abcChartData} />
          </CardContent>
        </Card>

        {/* Movement by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.movement_by_type")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("inventory.type")}</th>
                  <th className="text-right py-2 font-medium">{t("inventory.stock_in")}</th>
                  <th className="text-right py-2 font-medium">{t("inventory.stock_out")}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(movementByType.entries()).map(([type, val]) => (
                  <tr key={type} className="border-b hover:bg-slate-50">
                    <td className="py-2 text-xs font-medium">{type}</td>
                    <td className="py-2 text-right text-xs text-green-600">+{val.in}</td>
                    <td className="py-2 text-right text-xs text-red-600">-{val.out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dead Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.dead_stock")}</CardTitle>
          </CardHeader>
          <CardContent>
            {deadStockItems.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">{t("inventory.product")}</th>
                    <th className="text-right py-2 font-medium">{t("inventory.stock_col")}</th>
                    <th className="text-right py-2 font-medium">{t("inventory.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStockItems.map((item) => (
                    <tr key={item.sku} className="border-b hover:bg-slate-50">
                      <td className="py-2">
                        <p className="text-xs font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </td>
                      <td className="py-2 text-right text-xs">{item.stock}</td>
                      <td className="py-2 text-right text-xs font-medium text-amber-600">
                        {formatMoney(item.value, { locale, currency })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("inventory.no_dead_stock")}</p>
            )}
          </CardContent>
        </Card>

        {/* Restock Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.restock_suggestions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {restockSuggestions.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">SKU</th>
                    <th className="text-right py-2 font-medium">{t("inventory.daily_avg")}</th>
                    <th className="text-right py-2 font-medium">{t("inventory.current")}</th>
                    <th className="text-right py-2 font-medium">{t("inventory.needed_14d")}</th>
                  </tr>
                </thead>
                <tbody>
                  {restockSuggestions.map((s) => (
                    <tr key={s.sku} className="border-b hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs">{s.sku}</td>
                      <td className="py-2 text-right text-xs">{s.dailyAvg}</td>
                      <td className="py-2 text-right text-xs">{s.currentStock}</td>
                      <td className="py-2 text-right text-xs font-medium text-red-600">+{s.deficit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("inventory.no_restock")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sold */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.top_sold")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">SKU</th>
                  <th className="text-right py-2 font-medium">{t("inventory.units_sold")}</th>
                </tr>
              </thead>
              <tbody>
                {topSold.map((item, i) => (
                  <tr key={item.variantId} className="border-b hover:bg-slate-50">
                    <td className="py-2">
                      <span className="text-muted-foreground text-xs mr-2">{i + 1}.</span>
                      <span className="font-mono text-xs">{item.sku}</span>
                    </td>
                    <td className="py-2 text-right font-medium">
                      {Number(item._sum.quantity ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Out of Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inventory.out_of_stock_list")}</CardTitle>
          </CardHeader>
          <CardContent>
            {outOfStockVariants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {t("inventory.no_out_of_stock")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">{t("inventory.product")}</th>
                    <th className="text-right py-2 font-medium">{t("inventory.stock_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfStockVariants.map((v) => {
                    const content = v.product.content as Record<string, Record<string, string> | string> | null;
                    const name =
                      (content?.es as Record<string, string> | undefined)?.name ||
                      (content?.en as Record<string, string> | undefined)?.name ||
                      (content?.name as string | undefined) ||
                      v.sku;
                    return (
                      <tr key={v.id} className="border-b hover:bg-slate-50">
                        <td className="py-2">
                          <p className="font-medium text-xs">{name}</p>
                          <p className="text-xs text-muted-foreground">{v.sku}</p>
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant="destructive" className="text-xs">
                            {t("inventory.out_of_stock_badge")}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
