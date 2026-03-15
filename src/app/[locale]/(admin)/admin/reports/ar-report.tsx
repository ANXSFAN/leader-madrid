import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { DateRange, getMonthlyBuckets, getMonthKey, formatPercent } from "@/lib/report-utils";
import { AgingChart, CollectionRateChart } from "./ar-charts-client";
import { ExportReportButton } from "@/components/admin/export-report-button";

export async function ARReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  // Fetch all invoices
  const invoices = await db.invoice.findMany({
    where: {
      createdAt: { gte: dateRange.from, lte: dateRange.to },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      issueDate: true,
      dueDate: true,
      customerId: true,
      createdAt: true,
    },
  });

  const now = new Date();

  // KPI calculations
  let totalReceivable = 0;
  let totalOverdue = 0;
  let totalPaid = 0;
  let totalInvoiced = 0;
  let dsoNumerator = 0; // weighted days outstanding
  let dsoCount = 0;

  // Aging buckets
  let aging0_30 = 0;
  let aging31_60 = 0;
  let aging61_90 = 0;
  let aging90plus = 0;

  // Customer receivable
  const customerARMap = new Map<string, { outstanding: number; overdue: number }>();

  for (const inv of invoices) {
    const total = Number(inv.totalAmount);
    const paid = Number(inv.paidAmount);
    const outstanding = total - paid;
    totalInvoiced += total;
    totalPaid += paid;

    if (outstanding > 0) {
      totalReceivable += outstanding;

      const daysSinceDue = Math.max(0, Math.round((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysSinceIssue = Math.round((now.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (inv.status === "OVERDUE" || daysSinceDue > 0) {
        totalOverdue += outstanding;
      }

      // Aging based on days since issue
      if (daysSinceIssue <= 30) aging0_30 += outstanding;
      else if (daysSinceIssue <= 60) aging31_60 += outstanding;
      else if (daysSinceIssue <= 90) aging61_90 += outstanding;
      else aging90plus += outstanding;

      // DSO
      dsoNumerator += outstanding * daysSinceIssue;
      dsoCount += outstanding;

      // Customer
      if (!customerARMap.has(inv.customerId)) {
        customerARMap.set(inv.customerId, { outstanding: 0, overdue: 0 });
      }
      const cm = customerARMap.get(inv.customerId)!;
      cm.outstanding += outstanding;
      if (inv.status === "OVERDUE" || daysSinceDue > 0) {
        cm.overdue += outstanding;
      }
    }
  }

  const avgDSO = dsoCount > 0 ? Math.round(dsoNumerator / dsoCount) : 0;
  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

  // Monthly collection rate
  const monthlyMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ invoiced: 0, paid: 0 }));
  for (const inv of invoices) {
    const mk = getMonthKey(inv.createdAt);
    if (monthlyMap.has(mk)) {
      const bucket = monthlyMap.get(mk)!;
      bucket.invoiced += Number(inv.totalAmount);
      bucket.paid += Number(inv.paidAmount);
    }
  }

  const collectionRateChart = Array.from(monthlyMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return {
      name: label,
      rate: val.invoiced > 0 ? Math.round((val.paid / val.invoiced) * 1000) / 10 : 0,
    };
  });

  // Aging chart data (single bar with stacked segments)
  const agingChart = [{
    name: t("ar.current_period"),
    "0-30": Math.round(aging0_30 * 100) / 100,
    "31-60": Math.round(aging31_60 * 100) / 100,
    "61-90": Math.round(aging61_90 * 100) / 100,
    "90+": Math.round(aging90plus * 100) / 100,
  }];

  // Customer AR table
  const topCustomerAR = Array.from(customerARMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  const customerIds = topCustomerAR.map((c) => c.id);
  const customers = customerIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, companyName: true },
      })
    : [];
  const customerNameMap = new Map(customers.map((c) => [c.id, c.companyName || c.name || c.id.slice(0, 8)]));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportReportButton type="ar" dateRange={dateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("ar.total_receivable")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalReceivable, { locale, currency })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("ar.total_overdue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatMoney(totalOverdue, { locale, currency })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("ar.avg_dso")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgDSO} {t("ar.days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("ar.collection_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${collectionRate >= 80 ? "text-green-600" : collectionRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {formatPercent(collectionRate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ar.aging_analysis")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingChart data={agingChart} locale={locale} currency={currency} />
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">0-30 {t("ar.days")}</p>
                <p className="text-sm font-medium text-green-600">{formatMoney(aging0_30, { locale, currency })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">31-60 {t("ar.days")}</p>
                <p className="text-sm font-medium text-amber-600">{formatMoney(aging31_60, { locale, currency })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">61-90 {t("ar.days")}</p>
                <p className="text-sm font-medium text-orange-600">{formatMoney(aging61_90, { locale, currency })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">90+ {t("ar.days")}</p>
                <p className="text-sm font-medium text-red-600">{formatMoney(aging90plus, { locale, currency })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ar.collection_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CollectionRateChart data={collectionRateChart} />
          </CardContent>
        </Card>
      </div>

      {/* Customer AR Table */}
      {topCustomerAR.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ar.by_customer")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("ar.customer")}</th>
                  <th className="text-right py-2 font-medium">{t("ar.outstanding")}</th>
                  <th className="text-right py-2 font-medium">{t("ar.overdue")}</th>
                </tr>
              </thead>
              <tbody>
                {topCustomerAR.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 text-xs font-medium">{customerNameMap.get(c.id) || c.id.slice(0, 8)}</td>
                    <td className="py-2 text-right text-xs font-medium">
                      {formatMoney(c.outstanding, { locale, currency })}
                    </td>
                    <td className={`py-2 text-right text-xs ${c.overdue > 0 ? "text-red-600 font-medium" : ""}`}>
                      {formatMoney(c.overdue, { locale, currency })}
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
