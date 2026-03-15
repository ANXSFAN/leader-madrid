import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { DateRange, getMonthlyBuckets, getMonthKey } from "@/lib/report-utils";
import { ProcurementSpendChart, POStatusChart } from "./procurement-charts-client";
import { ExportReportButton } from "@/components/admin/export-report-button";

export async function ProcurementReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  const [
    purchaseOrders,
    poStatusBreakdown,
    activeSuppliers,
    allPOs,
  ] = await Promise.all([
    db.purchaseOrder.aggregate({
      _sum: { totalAmount: true },
      _count: { _all: true },
      _avg: { totalAmount: true },
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
    }),
    db.purchaseOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
    }),
    db.purchaseOrder.findMany({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
    db.purchaseOrder.findMany({
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  const totalSpend = Number(purchaseOrders._sum.totalAmount ?? 0);
  const poCount = purchaseOrders._count._all;
  const avgPOAmount = Number(purchaseOrders._avg.totalAmount ?? 0);
  const supplierCount = activeSuppliers.length;

  // Monthly spend
  const monthlyMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ amount: 0 }));
  for (const po of allPOs) {
    const mk = getMonthKey(po.createdAt);
    if (monthlyMap.has(mk)) {
      monthlyMap.get(mk)!.amount += Number(po.totalAmount);
    }
  }

  const monthlyChart = Array.from(monthlyMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return { name: label, amount: Math.round(val.amount * 100) / 100 };
  });

  // PO status pie chart
  const poStatusData = poStatusBreakdown.map((g) => ({
    name: g.status,
    value: g._count._all,
  }));

  // Supplier delivery performance (days from creation to RECEIVED)
  const receivedPOs = await db.purchaseOrder.findMany({
    where: {
      status: "RECEIVED",
      createdAt: { gte: dateRange.from, lte: dateRange.to },
    },
    select: {
      createdAt: true,
      updatedAt: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  const supplierPerfMap = new Map<string, { name: string; totalDays: number; count: number }>();
  for (const po of receivedPOs) {
    const days = Math.round((po.updatedAt.getTime() - po.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const sid = po.supplier.id;
    if (!supplierPerfMap.has(sid)) {
      supplierPerfMap.set(sid, { name: po.supplier.name || sid.slice(0, 8), totalDays: 0, count: 0 });
    }
    const sp = supplierPerfMap.get(sid)!;
    sp.totalDays += days;
    sp.count += 1;
  }

  const supplierPerf = Array.from(supplierPerfMap.values())
    .map((s) => ({ ...s, avgDays: Math.round(s.totalDays / s.count) }))
    .sort((a, b) => a.avgDays - b.avgDays);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportReportButton type="procurement" dateRange={dateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("procurement.total_spend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalSpend, { locale, currency })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("procurement.po_count")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{poCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("procurement.active_suppliers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{supplierCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("procurement.avg_po_amount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(avgPOAmount, { locale, currency })}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("procurement.monthly_spend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcurementSpendChart data={monthlyChart} locale={locale} currency={currency} />
          </CardContent>
        </Card>

        {/* PO Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("procurement.po_status_dist")}</CardTitle>
          </CardHeader>
          <CardContent>
            {poStatusData.length > 0 ? (
              <POStatusChart data={poStatusData} />
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("procurement.no_data")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier Delivery Performance */}
      {supplierPerf.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("procurement.supplier_performance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("procurement.supplier")}</th>
                  <th className="text-right py-2 font-medium">{t("procurement.completed_pos")}</th>
                  <th className="text-right py-2 font-medium">{t("procurement.avg_delivery_days")}</th>
                </tr>
              </thead>
              <tbody>
                {supplierPerf.map((s) => (
                  <tr key={s.name} className="border-b hover:bg-slate-50">
                    <td className="py-2 text-xs font-medium">{s.name}</td>
                    <td className="py-2 text-right text-xs">{s.count}</td>
                    <td className="py-2 text-right text-xs">
                      <span className={s.avgDays <= 7 ? "text-green-600" : s.avgDays <= 14 ? "text-amber-600" : "text-red-600"}>
                        {s.avgDays} {t("procurement.days")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
