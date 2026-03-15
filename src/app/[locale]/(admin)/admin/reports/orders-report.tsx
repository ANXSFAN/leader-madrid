import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { ExportReportButton } from "@/components/admin/export-report-button";
import { DateRange, getMonthlyBuckets, getMonthKey, formatPercent } from "@/lib/report-utils";
import { ReturnsByReasonChart, MonthlyReturnRateChart } from "./returns-analysis-client";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  CONFIRMED: "bg-blue-500",
  PROCESSING: "bg-indigo-500",
  SHIPPED: "bg-purple-500",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-500",
  RETURNED: "bg-orange-500",
  DRAFT: "bg-gray-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  PAID: "bg-green-500",
  FAILED: "bg-red-500",
  REFUNDED: "bg-orange-500",
};

export async function OrdersReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  const [
    statusBreakdown,
    paymentBreakdown,
    recentOrders,
    soStatusBreakdown,
    // Returns data
    returnsByReason,
    totalReturns,
    totalRefundAmount,
    monthlyOrders,
    monthlyReturns,
  ] = await Promise.all([
    db.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { total: true },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.order.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
      _sum: { total: true },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true, companyName: true } },
      },
    }),
    db.salesOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    // Returns by reason
    db.returnRequest.groupBy({
      by: ["reason"],
      _count: { _all: true },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.returnRequest.count({
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.returnRequest.aggregate({
      _sum: { refundAmount: true },
      where: {
        createdAt: { gte: dateRange.from, lte: dateRange.to },
        status: { in: ["APPROVED", "RECEIVED", "REFUNDED", "CLOSED"] },
      },
    }),
    // Monthly order counts for return rate
    db.order.groupBy({
      by: ["createdAt"],
      _count: { _all: true },
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
    }),
    db.returnRequest.findMany({
      where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
      select: { createdAt: true },
    }),
  ]);

  const totalOrders = statusBreakdown.reduce((s, g) => s + g._count._all, 0);
  const deliveredCount = statusBreakdown.find((g) => g.status === "DELIVERED")?._count._all ?? 0;
  const fulfillmentRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;

  const pendingPaymentTotal = paymentBreakdown
    .filter((g) => g.paymentStatus === "PENDING")
    .reduce((s, g) => s + Number(g._sum.total ?? 0), 0);

  // Return rate
  const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;
  const refundTotal = Number(totalRefundAmount._sum.refundAmount ?? 0);

  // Returns by reason chart data
  const returnReasonData = returnsByReason.map((g) => ({
    name: g.reason,
    value: g._count._all,
  }));

  // Monthly return rate trend
  const orderMonthlyMap = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ orders: 0, returns: 0 }));
  // Count orders per month by iterating monthlyOrders groupBy result
  for (const o of monthlyOrders) {
    const mk = getMonthKey(o.createdAt);
    if (orderMonthlyMap.has(mk)) {
      orderMonthlyMap.get(mk)!.orders += o._count._all;
    }
  }
  for (const r of monthlyReturns) {
    const mk = getMonthKey(r.createdAt);
    if (orderMonthlyMap.has(mk)) {
      orderMonthlyMap.get(mk)!.returns += 1;
    }
  }

  const monthlyReturnChart = Array.from(orderMonthlyMap.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return {
      name: label,
      returnRate: val.orders > 0 ? Math.round((val.returns / val.orders) * 1000) / 10 : 0,
      returns: val.returns,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportReportButton type="orders" dateRange={dateRange} />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("orders.total_orders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("orders.pending_payment")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatMoney(pendingPaymentTotal, { locale, currency })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("orders.fulfillment_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatPercent(fulfillmentRate)}</p>
            <p className="text-xs text-muted-foreground">{t("orders.delivered_ratio")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("orders.return_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${returnRate > 5 ? "text-red-600" : returnRate > 2 ? "text-amber-600" : "text-green-600"}`}>
              {formatPercent(returnRate)}
            </p>
            <p className="text-xs text-muted-foreground">{totalReturns} {t("orders.returns_count")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("orders.status_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBreakdown
              .sort((a, b) => b._count._all - a._count._all)
              .map((g) => {
                const pct = totalOrders > 0 ? (g._count._all / totalOrders) * 100 : 0;
                return (
                  <div key={g.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[g.status] || "bg-gray-400"}`} />
                        <span>{g.status}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {g._count._all} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${STATUS_COLORS[g.status] || "bg-gray-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Payment Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("orders.payment_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentBreakdown
              .sort((a, b) => b._count._all - a._count._all)
              .map((g) => {
                const pct = totalOrders > 0 ? (g._count._all / totalOrders) * 100 : 0;
                return (
                  <div key={g.paymentStatus} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${PAYMENT_COLORS[g.paymentStatus] || "bg-gray-400"}`} />
                        <span>{g.paymentStatus}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {g._count._all} · {formatMoney(Number(g._sum.total ?? 0), { locale, currency })}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${PAYMENT_COLORS[g.paymentStatus] || "bg-gray-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* Sales Orders Status */}
      {soStatusBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("orders.sales_orders_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {soStatusBreakdown.map((g) => (
                <div key={g.status} className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-3">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[g.status] || "bg-gray-400"}`} />
                  <div>
                    <p className="text-sm font-medium">{g.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {g._count._all} · {formatMoney(Number(g._sum.totalAmount ?? 0), { locale, currency })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Returns Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Returns by Reason */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("orders.returns_by_reason")}</CardTitle>
          </CardHeader>
          <CardContent>
            {returnReasonData.length > 0 ? (
              <>
                <ReturnsByReasonChart data={returnReasonData} />
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  {t("orders.refund_total")}: {formatMoney(refundTotal, { locale, currency })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("orders.no_returns")}</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Return Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("orders.monthly_return_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyReturnRateChart data={monthlyReturnChart} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("orders.recent_orders")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">{t("orders.order_number")}</th>
                <th className="text-left py-2 font-medium">{t("orders.customer_col")}</th>
                <th className="text-center py-2 font-medium">{t("orders.status_col")}</th>
                <th className="text-center py-2 font-medium">{t("orders.payment_col")}</th>
                <th className="text-right py-2 font-medium">{t("orders.total_col")}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-slate-50">
                  <td className="py-2">
                    <span className="font-mono text-xs">{order.orderNumber}</span>
                    <p className="text-xs text-muted-foreground">
                      {order.createdAt.toLocaleDateString(locale)}
                    </p>
                  </td>
                  <td className="py-2">
                    <p className="text-xs font-medium">
                      {order.user?.companyName || order.user?.name || "Guest"}
                    </p>
                  </td>
                  <td className="py-2 text-center">
                    <Badge variant="outline" className="text-xs">
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-center">
                    <Badge
                      variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="py-2 text-right font-medium text-xs">
                    {formatMoney(Number(order.total), { locale, currency })}
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
