import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesChartClient } from "./charts-client";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { ExportReportButton } from "@/components/admin/export-report-button";
import { DateRange, getMonthlyBuckets, getMonthKey, formatPercent } from "@/lib/report-utils";
import { YoYComparisonChart, CountryDistributionChart, SalesFunnelChart } from "./sales-charts-enhanced";
import { subYears } from "date-fns";

export async function SalesReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  // Current period orders
  const currentOrders = await db.order.findMany({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      status: { notIn: ["CANCELLED"] },
    },
    select: { createdAt: true, total: true, tax: true, subtotal: true, shippingAddress: true },
  });

  // Previous year same period (for YoY)
  const prevFrom = subYears(dateRange.from, 1);
  const prevTo = subYears(dateRange.to, 1);
  const prevOrders = await db.order.findMany({
    where: {
      createdAt: { gte: prevFrom, lte: prevTo },
      status: { notIn: ["CANCELLED"] },
    },
    select: { createdAt: true, total: true },
  });

  // Monthly buckets for current period
  const monthlyMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ revenue: 0, count: 0 }));
  currentOrders.forEach((o) => {
    const key = getMonthKey(o.createdAt);
    if (monthlyMap.has(key)) {
      const prev = monthlyMap.get(key)!;
      prev.revenue += Number(o.total);
      prev.count += 1;
    }
  });

  const monthlyChart = Array.from(monthlyMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return { name: label, revenue: Math.round(val.revenue * 100) / 100, orders: val.count };
  });

  // YoY comparison: monthly buckets for previous year
  const prevMonthlyMap = getMonthlyBuckets(prevFrom, prevTo, () => ({ revenue: 0 }));
  prevOrders.forEach((o) => {
    const key = getMonthKey(o.createdAt);
    if (prevMonthlyMap.has(key)) {
      prevMonthlyMap.get(key)!.revenue += Number(o.total);
    }
  });

  // Build YoY chart: align months
  const currentEntries = Array.from(monthlyMap.entries());
  const prevEntries = Array.from(prevMonthlyMap.entries());
  const yoyChart = currentEntries.map(([key, val], i) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short" });
    const prevVal = prevEntries[i]?.[1]?.revenue ?? 0;
    return { name: label, current: Math.round(val.revenue * 100) / 100, previous: Math.round(prevVal * 100) / 100 };
  });

  // Top products
  const topProducts = await db.orderItem.groupBy({
    by: ["variantId", "name", "sku"],
    _sum: { total: true },
    _count: { _all: true },
    where: {
      order: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { notIn: ["CANCELLED"] },
      },
    },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });

  // Stats
  const totalRevenue = currentOrders.reduce((s, o) => s + Number(o.total), 0);
  const totalVAT = currentOrders.reduce((s, o) => s + Number(o.tax ?? 0), 0);
  const totalNet = currentOrders.reduce((s, o) => s + Number(o.subtotal ?? 0), 0);
  const avgOrderVal = currentOrders.length > 0 ? totalRevenue / currentOrders.length : 0;
  const prevTotalRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0);
  const yoyChange = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;

  // Country distribution
  const countryMap = new Map<string, number>();
  for (const o of currentOrders) {
    const addr = o.shippingAddress as any;
    const country = addr?.country || addr?.countryCode || "Unknown";
    countryMap.set(country, (countryMap.get(country) || 0) + Number(o.total));
  }
  const countryData = Array.from(countryMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Sales funnel: RFQ -> QUOTED -> ACCEPTED -> DELIVERED orders
  const [rfqTotal, rfqQuoted, rfqAccepted, deliveredOrders] = await Promise.all([
    db.rFQRequest.count({
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.rFQRequest.count({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { in: ["QUOTED", "ACCEPTED"] },
      },
    }),
    db.rFQRequest.count({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: "ACCEPTED",
      },
    }),
    db.order.count({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: "DELIVERED",
      },
    }),
  ]);

  const funnelSteps = [
    { label: t("sales.funnel_rfq"), value: rfqTotal },
    { label: t("sales.funnel_quoted"), value: rfqQuoted },
    { label: t("sales.funnel_accepted"), value: rfqAccepted },
    { label: t("sales.funnel_delivered"), value: deliveredOrders },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportReportButton type="sales" dateRange={dateRange} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("sales.total_revenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalRevenue, { locale, currency })}</p>
            <p className="text-xs text-muted-foreground">{t("sales.orders_count", { count: currentOrders.length })}</p>
            {prevTotalRevenue > 0 && (
              <p className={`text-xs font-medium ${yoyChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {yoyChange >= 0 ? "+" : ""}{formatPercent(yoyChange)} YoY
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("sales.avg_order")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(avgOrderVal, { locale, currency })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("sales.vat_collected")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalVAT, { locale, currency })}</p>
            <p className="text-xs text-muted-foreground">
              {t("sales.net_base")} {formatMoney(totalNet, { locale, currency })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("sales.prev_year")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(prevTotalRevenue, { locale, currency })}</p>
            <p className="text-xs text-muted-foreground">{t("sales.same_period")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sales.monthly_chart_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChartClient data={monthlyChart} locale={locale} currency={currency} />
        </CardContent>
      </Card>

      {/* YoY Comparison */}
      {yoyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sales.yoy_comparison")}</CardTitle>
          </CardHeader>
          <CardContent>
            <YoYComparisonChart
              data={yoyChart}
              locale={locale}
              currency={currency}
              currentLabel={t("sales.current_period")}
              previousLabel={t("sales.previous_period")}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country Distribution */}
        {countryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("sales.by_country")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CountryDistributionChart data={countryData} locale={locale} currency={currency} />
            </CardContent>
          </Card>
        )}

        {/* Sales Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sales.sales_funnel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesFunnelChart steps={funnelSteps} />
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sales.top_products_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">#</th>
                <th className="text-left py-2 font-medium">{t("sales.product_sku")}</th>
                <th className="text-right py-2 font-medium">{t("sales.units")}</th>
                <th className="text-right py-2 font-medium">{t("sales.revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.variantId} className="border-b hover:bg-slate-50">
                  <td className="py-3 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="py-3">
                    <p className="font-medium text-sm">{p.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </td>
                  <td className="py-3 text-right">{p._count._all}</td>
                  <td className="py-3 text-right font-medium">
                    {formatMoney(Number(p._sum.total ?? 0), { locale, currency })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
