import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Euro,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Users,
  Package,
  TrendingUp,
  UserCheck,
  Percent,
  BarChart3,
  RotateCcw,
  UserPlus,
  CalendarDays,
  Banknote,
  CheckCircle2,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Overview } from "@/components/admin/overview";
import { RecentSales } from "@/components/admin/recent-sales";
import { OrderStatusChart } from "@/components/admin/order-status-chart";
import { MonthlyTarget } from "@/components/admin/monthly-target";
import { getLocale } from "next-intl/server";
import { getSiteSettings, getGlobalConfig } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { getTranslations } from "next-intl/server";
import { getLocalized } from "@/lib/content";
import { SendStockAlertButton } from "@/components/admin/send-stock-alert-button";
import { StatCard } from "@/components/admin/stat-card";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

async function getDashboardData(locale: string) {
  noStore();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59
  );
  const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // SO filter: exclude ORD- prefixed SalesOrders to avoid double-counting with Orders
  const soStandaloneFilter = { orderNumber: { not: { startsWith: "ORD-" } } };

  const [
    totalRevenueResult,
    monthlyRevenueResult,
    lastMonthRevenueResult,
    monthlyOrdersCount,
    lastMonthOrdersCount,
    // SalesOrder standalone aggregates (non-ORD- prefix)
    soTotalRevenueResult,
    soMonthlyRevenueResult,
    soLastMonthRevenueResult,
    soMonthlyOrdersCount,
    soLastMonthOrdersCount,
    pendingOrdersCount,
    soPendingCount,
    lowStockCountRaw,
    totalCustomers,
    newCustomersThisMonth,
    pendingB2BCount,
    recentOrders,
    chartDataRaw,
    soChartDataRaw,
    lowStockVariantsRaw,
    // New KPI queries
    monthlyCostResult,
    lastMonthCostResult,
    soMonthlyCostResult,
    soLastMonthCostResult,
    // RFQ stats
    rfqTotalThisMonth,
    rfqAcceptedThisMonth,
    // Return stats
    returnCountThisMonth,
    // Order status distribution
    orderStatusCounts,
    soStatusCounts,
    // Today's KPIs
    todayOrdersCount,
    todayRevenueResult,
    todaySOCount,
    todaySORevenueResult,
    // Pending approvals
    pendingApprovalsCount,
  ] = await Promise.all([
    // --- Existing queries ---
    db.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "CANCELLED" } },
    }),
    db.order.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    db.order.aggregate({
      _sum: { total: true },
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: { not: "CANCELLED" },
      },
    }),
    db.order.count({
      where: { createdAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    db.order.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: { not: "CANCELLED" },
      },
    }),
    // Standalone SalesOrder aggregates
    db.salesOrder.aggregate({
      _sum: { totalAmount: true },
      where: { ...soStandaloneFilter, status: { not: "CANCELLED" } },
    }),
    db.salesOrder.aggregate({
      _sum: { totalAmount: true },
      where: { ...soStandaloneFilter, createdAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    db.salesOrder.aggregate({
      _sum: { totalAmount: true },
      where: {
        ...soStandaloneFilter,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: { not: "CANCELLED" },
      },
    }),
    db.salesOrder.count({
      where: { ...soStandaloneFilter, createdAt: { gte: startOfMonth }, status: { not: "CANCELLED" } },
    }),
    db.salesOrder.count({
      where: {
        ...soStandaloneFilter,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: { not: "CANCELLED" },
      },
    }),
    db.order.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
    }),
    db.salesOrder.count({
      where: { ...soStandaloneFilter, status: { in: ["DRAFT", "CONFIRMED"] } },
    }),
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM product_variants WHERE "physicalStock" <= "minStock"`,
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } },
    }),
    db.user.count({ where: { b2bStatus: "PENDING" } }),
    db.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    db.order.findMany({
      where: {
        createdAt: { gte: startOf6MonthsAgo },
        status: { not: "CANCELLED" },
      },
      select: { createdAt: true, total: true },
    }),
    db.salesOrder.findMany({
      where: {
        ...soStandaloneFilter,
        createdAt: { gte: startOf6MonthsAgo },
        status: { not: "CANCELLED" },
      },
      select: { createdAt: true, totalAmount: true },
    }),
    db.$queryRaw<Array<{
      id: string;
      sku: string;
      physicalStock: number;
      minStock: number;
      productId: string;
      content: unknown;
    }>>`
      SELECT pv.id, pv.sku, pv."physicalStock", pv."minStock", pv."productId", p.content
      FROM product_variants pv
      JOIN products p ON pv."productId" = p.id
      WHERE pv."physicalStock" <= pv."minStock"
      ORDER BY pv."physicalStock" ASC
      LIMIT 5
    `,
    // --- New: Cost aggregations for gross margin ---
    db.$queryRaw<[{ total_cost: number | null }]>`
      SELECT COALESCE(SUM(oi."costPrice" * oi.quantity), 0)::float as total_cost
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      WHERE o."createdAt" >= ${startOfMonth}
        AND o.status != 'CANCELLED'
        AND oi."costPrice" IS NOT NULL
    `,
    db.$queryRaw<[{ total_cost: number | null }]>`
      SELECT COALESCE(SUM(oi."costPrice" * oi.quantity), 0)::float as total_cost
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      WHERE o."createdAt" >= ${startOfLastMonth}
        AND o."createdAt" <= ${endOfLastMonth}
        AND o.status != 'CANCELLED'
        AND oi."costPrice" IS NOT NULL
    `,
    db.$queryRaw<[{ total_cost: number | null }]>`
      SELECT COALESCE(SUM(soi."costPrice" * soi.quantity), 0)::float as total_cost
      FROM sales_order_items soi
      JOIN sales_orders so ON soi."soId" = so.id
      WHERE so."createdAt" >= ${startOfMonth}
        AND so.status != 'CANCELLED'
        AND so."orderNumber" NOT LIKE 'ORD-%'
        AND soi."costPrice" IS NOT NULL
    `,
    db.$queryRaw<[{ total_cost: number | null }]>`
      SELECT COALESCE(SUM(soi."costPrice" * soi.quantity), 0)::float as total_cost
      FROM sales_order_items soi
      JOIN sales_orders so ON soi."soId" = so.id
      WHERE so."createdAt" >= ${startOfLastMonth}
        AND so."createdAt" <= ${endOfLastMonth}
        AND so.status != 'CANCELLED'
        AND so."orderNumber" NOT LIKE 'ORD-%'
        AND soi."costPrice" IS NOT NULL
    `,
    // RFQ stats this month
    db.rFQRequest.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    db.rFQRequest.count({
      where: { createdAt: { gte: startOfMonth }, status: "ACCEPTED" },
    }),
    // Return count this month
    db.returnRequest.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    // Order status distribution (all orders)
    db.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // SalesOrder status distribution (standalone only)
    db.salesOrder.groupBy({
      by: ["status"],
      where: soStandaloneFilter,
      _count: { _all: true },
    }),
    // Today's orders count
    db.order.count({
      where: { createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
    }),
    // Today's revenue
    db.order.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
    }),
    // Today's standalone SO count
    db.salesOrder.count({
      where: { ...soStandaloneFilter, createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
    }),
    // Today's standalone SO revenue
    db.salesOrder.aggregate({
      _sum: { totalAmount: true },
      where: { ...soStandaloneFilter, createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
    }),
    // Pending approvals
    db.approvalRequest.count({
      where: { status: "PENDING" },
    }),
  ]);

  const lowStockCount = Number(lowStockCountRaw[0]?.count ?? 0);
  const lowStockVariants = lowStockVariantsRaw.map((v) => ({
    id: v.id,
    sku: v.sku,
    physicalStock: v.physicalStock,
    minStock: v.minStock,
    productId: v.productId,
    product: { content: v.content },
  }));

  // Combine Order + standalone SalesOrder revenues
  const totalRevenue = Number(totalRevenueResult._sum.total || 0) + Number(soTotalRevenueResult._sum.totalAmount || 0);
  const monthlyRevenue = Number(monthlyRevenueResult._sum.total || 0) + Number(soMonthlyRevenueResult._sum.totalAmount || 0);
  const lastMonthRevenue = Number(lastMonthRevenueResult._sum.total || 0) + Number(soLastMonthRevenueResult._sum.totalAmount || 0);

  // Combined order counts
  const combinedMonthlyOrders = monthlyOrdersCount + soMonthlyOrdersCount;
  const combinedLastMonthOrders = lastMonthOrdersCount + soLastMonthOrdersCount;
  const combinedPendingOrders = pendingOrdersCount + soPendingCount;

  // Cost calculations for gross margin
  const monthlyCost = Number(monthlyCostResult[0]?.total_cost || 0) + Number(soMonthlyCostResult[0]?.total_cost || 0);
  const lastMonthCost = Number(lastMonthCostResult[0]?.total_cost || 0) + Number(soLastMonthCostResult[0]?.total_cost || 0);

  // Gross margin % = (revenue - cost) / revenue * 100
  const grossMargin = monthlyRevenue > 0 ? ((monthlyRevenue - monthlyCost) / monthlyRevenue) * 100 : 0;
  const lastMonthGrossMargin = lastMonthRevenue > 0 ? ((lastMonthRevenue - lastMonthCost) / lastMonthRevenue) * 100 : 0;
  const grossMarginTrend = lastMonthGrossMargin > 0 ? grossMargin - lastMonthGrossMargin : null;

  // Average order value
  const avgOrderValue = combinedMonthlyOrders > 0 ? monthlyRevenue / combinedMonthlyOrders : 0;
  const lastMonthAvgOrderValue = combinedLastMonthOrders > 0 ? lastMonthRevenue / combinedLastMonthOrders : 0;
  const avgOrderTrend = lastMonthAvgOrderValue > 0
    ? ((avgOrderValue - lastMonthAvgOrderValue) / lastMonthAvgOrderValue) * 100
    : null;

  // Revenue growth
  const revenueGrowth =
    lastMonthRevenue > 0
      ? (
          ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) *
          100
        ).toFixed(1)
      : null;

  const orderGrowth =
    combinedLastMonthOrders > 0
      ? (
          ((combinedMonthlyOrders - combinedLastMonthOrders) / combinedLastMonthOrders) *
          100
        ).toFixed(1)
      : null;

  // RFQ conversion rate
  const rfqConversionRate = rfqTotalThisMonth > 0
    ? (rfqAcceptedThisMonth / rfqTotalThisMonth) * 100
    : 0;

  // Today's KPIs
  const todayOrders = todayOrdersCount + todaySOCount;
  const todayRevenue = Number(todayRevenueResult._sum.total || 0) + Number(todaySORevenueResult._sum.totalAmount || 0);

  // Return rate
  const totalOrdersThisMonth = monthlyOrdersCount + soMonthlyOrdersCount;
  const returnRate = totalOrdersThisMonth > 0
    ? (returnCountThisMonth / totalOrdersThisMonth) * 100
    : 0;

  // Chart data
  const monthlyData = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyData.set(key, 0);
  }

  chartDataRaw.forEach((order) => {
    const d = order.createdAt;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyData.has(key)) {
      monthlyData.set(key, monthlyData.get(key)! + Number(order.total));
    }
  });

  // Include standalone SalesOrder revenue in chart
  soChartDataRaw.forEach((so) => {
    const d = so.createdAt;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyData.has(key)) {
      monthlyData.set(key, monthlyData.get(key)! + Number(so.totalAmount));
    }
  });

  const chartData = Array.from(monthlyData.entries()).map(([key, total]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month, 1).toLocaleString(locale, {
      month: "short",
    });
    return { name: label, total };
  });

  // Order status distribution (combine Order + SalesOrder)
  const statusMap = new Map<string, number>();
  orderStatusCounts.forEach((s) => {
    statusMap.set(s.status, (statusMap.get(s.status) || 0) + s._count._all);
  });
  soStatusCounts.forEach((s) => {
    // Map SOStatus to common display: DRAFT->PENDING
    const mapped = s.status === "DRAFT" ? "PENDING" : s.status;
    statusMap.set(mapped, (statusMap.get(mapped) || 0) + s._count._all);
  });

  // Recent orders with full data
  const recentSalesData = recentOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    name: order.user?.name || "Customer",
    email: order.user?.email || order.orderNumber,
    amount: Number(order.total),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));

  return {
    totalRevenue,
    monthlyRevenue,
    revenueGrowth,
    monthlyOrdersCount: combinedMonthlyOrders,
    orderGrowth,
    pendingOrdersCount: combinedPendingOrders,
    lowStockCount,
    totalCustomers,
    newCustomersThisMonth,
    pendingB2BCount,
    chartData,
    recentSalesData,
    lowStockVariants,
    currentMonth: now.toLocaleString(locale, { month: "long" }),
    // New KPIs
    grossMargin,
    grossMarginTrend,
    avgOrderValue,
    avgOrderTrend,
    rfqConversionRate,
    rfqTotalThisMonth,
    rfqAcceptedThisMonth,
    returnRate,
    returnCountThisMonth,
    orderStatusDistribution: statusMap,
    todayOrders,
    todayRevenue,
    pendingApprovals: pendingApprovalsCount,
  };
}

function formatTimeAgo(ms: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return t("time_ago_just_now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time_ago_minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time_ago_hours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("time_ago_days", { count: days });
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PROCESSING: "#8b5cf6",
  SHIPPED: "#06b6d4",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  RETURNED: "#f97316",
  DRAFT: "#94a3b8",
};

export default async function AdminDashboard() {
  const [locale, settings] = await Promise.all([getLocale(), getSiteSettings()]);
  const currency = settings.currency;
  const data = await getDashboardData(locale);
  const t = await getTranslations("admin.dashboard");

  const revenueGrowthNum = data.revenueGrowth ? parseFloat(data.revenueGrowth) : null;
  const orderGrowthNum = data.orderGrowth ? parseFloat(data.orderGrowth) : null;

  // Monthly sales target from GlobalConfig
  const targetConfig = await getGlobalConfig("monthly_sales_target");
  const monthlyTarget = targetConfig ? Number(targetConfig) : 10000;

  // Order status chart data
  const orderStatusChartData = [
    "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED",
  ].map((status) => ({
    name: t(`order_status_${status.toLowerCase()}` as Parameters<typeof t>[0]),
    value: data.orderStatusDistribution.get(status) || 0,
    color: ORDER_STATUS_COLORS[status],
  }));

  // Status labels for recent orders
  const statusLabels: Record<string, string> = {};
  for (const status of ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "DRAFT"]) {
    statusLabels[status] = t(`order_status_${status.toLowerCase()}` as Parameters<typeof t>[0]);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          data.pendingB2BCount > 0 ? (
            <Link href="/admin/customers">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 cursor-pointer hover:bg-amber-100 transition-colors">
                <UserCheck className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {t("pending_b2b_banner", { count: data.pendingB2BCount })}
                </span>
              </div>
            </Link>
          ) : undefined
        }
      />

      {/* Row 0: Today's Snapshot */}
      <div className="grid gap-4 grid-cols-3">
        <StatCard
          title={t("kpi_today_orders")}
          value={data.todayOrders}
          changeLabel={t("today_label")}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          title={t("kpi_today_revenue")}
          value={formatMoney(data.todayRevenue, { locale, currency })}
          changeLabel={t("today_label")}
          icon={Banknote}
          color="green"
        />
        <StatCard
          title={t("kpi_pending_approvals")}
          value={data.pendingApprovals}
          changeLabel={data.pendingApprovals > 0 ? t("requires_attention_label") : t("no_pending_requests")}
          icon={CheckCircle2}
          color={data.pendingApprovals > 0 ? "amber" : "green"}
        />
      </div>

      {/* Row 1: Core Financial KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("kpi_monthly_revenue")}
          value={formatMoney(data.monthlyRevenue, { locale, currency })}
          change={data.revenueGrowth}
          changeType={revenueGrowthNum === null ? "neutral" : revenueGrowthNum >= 0 ? "up" : "down"}
          changeLabel={t("vs_last_month")}
          icon={Euro}
          color="yellow"
        />
        <StatCard
          title={t("kpi_orders", { month: data.currentMonth })}
          value={data.monthlyOrdersCount}
          change={data.orderGrowth}
          changeType={orderGrowthNum === null ? "neutral" : orderGrowthNum >= 0 ? "up" : "down"}
          changeLabel={t("vs_last_month")}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title={t("kpi_gross_margin")}
          value={`${data.grossMargin.toFixed(1)}%`}
          icon={Percent}
          color="purple"
          changeLabel={t("kpi_gross_margin_desc")}
          trend={data.grossMarginTrend !== null ? {
            value: data.grossMarginTrend,
            label: t("vs_last_month"),
          } : undefined}
        />
        <StatCard
          title={t("kpi_avg_order_value")}
          value={formatMoney(data.avgOrderValue, { locale, currency })}
          icon={BarChart3}
          color="green"
          changeLabel={t("kpi_avg_order_desc")}
          trend={data.avgOrderTrend !== null ? {
            value: data.avgOrderTrend,
            label: t("vs_last_month"),
          } : undefined}
        />
      </div>

      {/* Row 2: Operational KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("kpi_pending_orders")}
          value={data.pendingOrdersCount}
          changeLabel={t("requires_attention_label")}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title={t("kpi_stock_alerts")}
          value={data.lowStockCount}
          changeLabel={t("stock_variants_lt_10")}
          icon={AlertTriangle}
          color={data.lowStockCount > 0 ? "red" : "green"}
        />
        <StatCard
          title={t("kpi_rfq_conversion")}
          value={`${data.rfqConversionRate.toFixed(1)}%`}
          changeLabel={t("kpi_rfq_conversion_desc", {
            accepted: data.rfqAcceptedThisMonth,
            total: data.rfqTotalThisMonth,
          })}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title={t("kpi_return_rate")}
          value={`${data.returnRate.toFixed(1)}%`}
          changeLabel={t("kpi_return_rate_desc", {
            count: data.returnCountThisMonth,
          })}
          icon={RotateCcw}
          color={data.returnRate > 5 ? "red" : data.returnRate > 2 ? "amber" : "green"}
        />
      </div>

      {/* Row 3: Customer KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("kpi_total_customers")}
          value={data.totalCustomers}
          changeLabel={t("history_cumulative")}
          icon={Users}
          color="blue"
        />
        <StatCard
          title={t("kpi_b2b_pending_requests")}
          value={data.pendingB2BCount}
          changeLabel={data.pendingB2BCount > 0 ? t("review_requests") : t("no_pending_requests")}
          icon={UserCheck}
          color={data.pendingB2BCount > 0 ? "amber" : "green"}
        />
        <StatCard
          title={t("kpi_new_customers")}
          value={data.newCustomersThisMonth}
          changeLabel={t("kpi_new_customers_desc")}
          icon={UserPlus}
          color="green"
        />
      </div>

      {/* Monthly Target Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("monthly_target_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyTarget
            actual={data.monthlyRevenue}
            target={monthlyTarget}
            actualFormatted={formatMoney(data.monthlyRevenue, { locale, currency })}
            targetFormatted={formatMoney(monthlyTarget, { locale, currency })}
            label={t("monthly_target_label")}
            ofLabel={t("monthly_target_of")}
          />
        </CardContent>
      </Card>

      {/* Charts: Sales Trend + Order Status Pie */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="border-l-4 border-yellow-500 pl-3">
              {t("chart_sales_last_6_months")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={data.chartData} locale={locale} currency={currency} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="border-l-4 border-yellow-500 pl-3">
              {t("chart_order_status")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusChart data={orderStatusChartData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("recent_orders")}
          </CardTitle>
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm" className="text-xs">
              {t("view_all")}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentSalesData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("no_orders")}
            </p>
          ) : (
            <RecentSales
              sales={data.recentSalesData}
              locale={locale}
              currency={currency}
              statusLabels={statusLabels}
              timeAgoLabel={(ms) => formatTimeAgo(ms, t)}
            />
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 border-l-4 border-yellow-500 pl-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t("inventory_alerts_title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.lowStockCount > 0 && <SendStockAlertButton />}
            <Link href="/admin/inventory">
              <Button variant="outline" size="sm" className="text-xs">
                {t("view_inventory")}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {data.lowStockVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("inventory_ok")}
            </p>
          ) : (
            <div className="space-y-3">
              {data.lowStockVariants.map((variant) => {
                const content = variant.product.content as Record<string, unknown> | null;
                const localized = getLocalized(content, locale);
                const productName = localized.name || "Product";
                const isOutOfStock = variant.physicalStock === 0;
                return (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between py-2 border-b last:border-0 last:pb-0 hover:bg-yellow-50/40 transition-colors rounded px-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[280px]">
                        {productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {variant.sku}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge
                        variant={isOutOfStock ? "status-cancelled" : "status-pending"}
                      >
                        {isOutOfStock
                          ? t("out_of_stock_label")
                          : t("units_suffix", { count: variant.physicalStock })}
                      </Badge>
                      <Link href={`/admin/products/${variant.productId}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <Package className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
