import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { DateRange, getMonthlyBuckets, getMonthKey, formatPercent } from "@/lib/report-utils";
import { MarginTrendChart, MarginByProductChart } from "./margin-charts-client";

export async function MarginReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  // Fetch order items with cost data within date range
  const orderItems = await db.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { notIn: ["CANCELLED"] },
      },
      costPrice: { not: null },
    },
    select: {
      quantity: true,
      price: true,
      costPrice: true,
      total: true,
      name: true,
      sku: true,
      variantId: true,
      order: { select: { createdAt: true, userId: true } },
    },
  });

  // Also fetch SalesOrderItems
  const soItems = await db.salesOrderItem.findMany({
    where: {
      so: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { notIn: ["CANCELLED"] },
      },
      costPrice: { not: null },
    },
    select: {
      quantity: true,
      unitPrice: true,
      costPrice: true,
      total: true,
      name: true,
      sku: true,
      variantId: true,
      so: { select: { createdAt: true, customerId: true } },
    },
  });

  // Calculate totals
  let totalRevenue = 0;
  let totalCost = 0;

  // Monthly buckets
  const monthlyMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({
    revenue: 0,
    cost: 0,
  }));

  // Product margin map
  const productMarginMap = new Map<string, { name: string; sku: string; revenue: number; cost: number; units: number }>();

  // Category margin via variant -> product -> category
  const categoryMarginMap = new Map<string, { name: string; revenue: number; cost: number }>();

  // Customer margin map
  const customerMarginMap = new Map<string, { revenue: number; cost: number }>();

  for (const item of orderItems) {
    const revenue = Number(item.total);
    const cost = Number(item.costPrice!) * item.quantity;
    totalRevenue += revenue;
    totalCost += cost;

    const mk = getMonthKey(item.order.createdAt);
    if (monthlyMap.has(mk)) {
      const bucket = monthlyMap.get(mk)!;
      bucket.revenue += revenue;
      bucket.cost += cost;
    }

    // Product
    const pk = item.variantId;
    if (!productMarginMap.has(pk)) {
      productMarginMap.set(pk, { name: item.name || "—", sku: item.sku || "—", revenue: 0, cost: 0, units: 0 });
    }
    const pm = productMarginMap.get(pk)!;
    pm.revenue += revenue;
    pm.cost += cost;
    pm.units += item.quantity;

    // Customer
    if (item.order.userId) {
      if (!customerMarginMap.has(item.order.userId)) {
        customerMarginMap.set(item.order.userId, { revenue: 0, cost: 0 });
      }
      const cm = customerMarginMap.get(item.order.userId)!;
      cm.revenue += revenue;
      cm.cost += cost;
    }
  }

  for (const item of soItems) {
    const revenue = Number(item.total);
    const cost = Number(item.costPrice!) * item.quantity;
    totalRevenue += revenue;
    totalCost += cost;

    const mk = getMonthKey(item.so.createdAt);
    if (monthlyMap.has(mk)) {
      const bucket = monthlyMap.get(mk)!;
      bucket.revenue += revenue;
      bucket.cost += cost;
    }

    const pk = item.variantId;
    if (!productMarginMap.has(pk)) {
      productMarginMap.set(pk, { name: item.name || "—", sku: item.sku || "—", revenue: 0, cost: 0, units: 0 });
    }
    const pm = productMarginMap.get(pk)!;
    pm.revenue += revenue;
    pm.cost += cost;
    pm.units += item.quantity;

    if (item.so.customerId) {
      if (!customerMarginMap.has(item.so.customerId)) {
        customerMarginMap.set(item.so.customerId, { revenue: 0, cost: 0 });
      }
      const cm = customerMarginMap.get(item.so.customerId)!;
      cm.revenue += revenue;
      cm.cost += cost;
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const totalMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Current period metrics (last 30 days within range)
  const thirtyDaysAgo = new Date(dateRange.to.getTime() - 30 * 24 * 60 * 60 * 1000);
  let periodRevenue = 0;
  let periodCost = 0;
  for (const item of orderItems) {
    if (item.order.createdAt >= thirtyDaysAgo) {
      periodRevenue += Number(item.total);
      periodCost += Number(item.costPrice!) * item.quantity;
    }
  }
  for (const item of soItems) {
    if (item.so.createdAt >= thirtyDaysAgo) {
      periodRevenue += Number(item.total);
      periodCost += Number(item.costPrice!) * item.quantity;
    }
  }
  const periodProfit = periodRevenue - periodCost;
  const periodMarginPct = periodRevenue > 0 ? (periodProfit / periodRevenue) * 100 : 0;

  // Monthly chart data
  const monthlyChart = Array.from(monthlyMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    const profit = val.revenue - val.cost;
    const marginPct = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;
    return {
      name: label,
      revenue: Math.round(val.revenue * 100) / 100,
      cost: Math.round(val.cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
    };
  });

  // Top 10 high margin products
  const allProducts = Array.from(productMarginMap.values());
  const topMarginProducts = [...allProducts]
    .map((p) => ({ ...p, profit: p.revenue - p.cost, marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  // Bottom 10 low margin products
  const bottomMarginProducts = [...allProducts]
    .filter((p) => p.revenue > 0)
    .map((p) => ({ ...p, profit: p.revenue - p.cost, marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, 10);

  // Top margin products chart data
  const topMarginChartData = topMarginProducts.map((p) => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + "..." : p.name,
    value: Math.round(p.profit * 100) / 100,
  }));

  // Customer margin - fetch user names
  const topCustomerMargins = Array.from(customerMarginMap.entries())
    .map(([userId, data]) => ({ userId, ...data, profit: data.revenue - data.cost }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  const customerIds = topCustomerMargins.map((c) => c.userId);
  const customers = customerIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, companyName: true },
      })
    : [];
  const customerNameMap = new Map(customers.map((c) => [c.id, c.companyName || c.name || c.id.slice(0, 8)]));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("margins.total_profit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalProfit, { locale, currency })}</p>
            <p className="text-xs text-muted-foreground">{t("margins.from_revenue", { amount: formatMoney(totalRevenue, { locale, currency }) })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("margins.margin_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalMarginPct >= 20 ? "text-green-600" : totalMarginPct >= 10 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(totalMarginPct)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("margins.period_profit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(periodProfit, { locale, currency })}</p>
            <p className="text-xs text-muted-foreground">{t("margins.last_30_days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("margins.period_margin")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${periodMarginPct >= 20 ? "text-green-600" : periodMarginPct >= 10 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(periodMarginPct)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t("margins.monthly_trend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MarginTrendChart data={monthlyChart} locale={locale} currency={currency} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 High Margin Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("margins.top_margin_products")}</CardTitle>
          </CardHeader>
          <CardContent>
            {topMarginProducts.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">{t("margins.product")}</th>
                    <th className="text-right py-2 font-medium">{t("margins.profit")}</th>
                    <th className="text-right py-2 font-medium">{t("margins.margin_pct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topMarginProducts.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-2">
                        <p className="font-medium text-xs">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </td>
                      <td className="py-2 text-right text-xs font-medium text-green-600">
                        {formatMoney(p.profit, { locale, currency })}
                      </td>
                      <td className="py-2 text-right text-xs">{formatPercent(p.marginPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("margins.no_data")}</p>
            )}
          </CardContent>
        </Card>

        {/* Bottom 10 Low Margin Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("margins.low_margin_products")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bottomMarginProducts.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">{t("margins.product")}</th>
                    <th className="text-right py-2 font-medium">{t("margins.profit")}</th>
                    <th className="text-right py-2 font-medium">{t("margins.margin_pct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bottomMarginProducts.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-2">
                        <p className="font-medium text-xs">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </td>
                      <td className={`py-2 text-right text-xs font-medium ${p.profit < 0 ? "text-red-600" : "text-amber-600"}`}>
                        {formatMoney(p.profit, { locale, currency })}
                      </td>
                      <td className="py-2 text-right text-xs">{formatPercent(p.marginPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("margins.no_data")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Margin by Product Chart */}
      {topMarginChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("margins.profit_by_product")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MarginByProductChart data={topMarginChartData} locale={locale} currency={currency} />
          </CardContent>
        </Card>
      )}

      {/* Customer Margin Analysis */}
      {topCustomerMargins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("margins.by_customer")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("margins.customer")}</th>
                  <th className="text-right py-2 font-medium">{t("margins.revenue")}</th>
                  <th className="text-right py-2 font-medium">{t("margins.profit")}</th>
                  <th className="text-right py-2 font-medium">{t("margins.margin_pct")}</th>
                </tr>
              </thead>
              <tbody>
                {topCustomerMargins.map((c) => {
                  const marginPct = c.revenue > 0 ? ((c.profit) / c.revenue) * 100 : 0;
                  return (
                    <tr key={c.userId} className="border-b hover:bg-slate-50">
                      <td className="py-2 text-xs font-medium">{customerNameMap.get(c.userId) || c.userId.slice(0, 8)}</td>
                      <td className="py-2 text-right text-xs">{formatMoney(c.revenue, { locale, currency })}</td>
                      <td className={`py-2 text-right text-xs font-medium ${c.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatMoney(c.profit, { locale, currency })}
                      </td>
                      <td className="py-2 text-right text-xs">{formatPercent(marginPct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
