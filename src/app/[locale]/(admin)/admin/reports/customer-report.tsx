import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { DateRange, getMonthlyBuckets, getMonthKey } from "@/lib/report-utils";

export async function CustomerReport({ dateRange }: { dateRange: DateRange }) {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalCustomers,
    b2bApproved,
    b2bPending,
    newThisMonth,
    topCustomers,
    b2bVsB2c,
    newCustomers,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { b2bStatus: "APPROVED" } }),
    db.user.count({ where: { b2bStatus: "PENDING" } }),
    db.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } },
    }),
    db.order.groupBy({
      by: ["userId"],
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
      where: {
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
    }),
    db.user.groupBy({
      by: ["b2bStatus"],
      _count: { _all: true },
      where: { role: "CUSTOMER" },
    }),
    // Batch query for monthly new customers instead of 12 individual queries
    db.user.findMany({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      },
      select: { createdAt: true },
    }),
  ]);

  const topCustomerIds = topCustomers.map((t) => t.userId).filter(Boolean) as string[];
  const topCustomerUsers = await db.user.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, name: true, email: true, companyName: true, b2bStatus: true },
  });
  const userMap = new Map(topCustomerUsers.map((u) => [u.id, u]));

  const b2bCount = b2bVsB2c.find((g) => g.b2bStatus === "APPROVED")?._count._all ?? 0;
  const b2cCount = totalCustomers - b2bCount;

  // Build monthly new customer chart from batch query
  const monthlyBuckets = getMonthlyBuckets(dateRange.from, dateRange.to, () => ({ count: 0 }));
  for (const c of newCustomers) {
    const mk = getMonthKey(c.createdAt);
    if (monthlyBuckets.has(mk)) {
      monthlyBuckets.get(mk)!.count += 1;
    }
  }
  const newMonthlyCustomers = Array.from(monthlyBuckets.entries()).map(([key, val]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
    return { label, count: val.count };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("customers.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCustomers}</p>
            <p className="text-xs text-muted-foreground">{t("customers.new_this_month", { count: newThisMonth })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("customers.b2b_approved")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{b2bApproved}</p>
            <p className="text-xs text-muted-foreground">
              {t("customers.of_total", { percent: totalCustomers > 0 ? ((b2bApproved / totalCustomers) * 100).toFixed(1) : 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">B2C</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{b2cCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase">{t("customers.b2b_pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${b2bPending > 0 ? "text-amber-600" : ""}`}>
              {b2bPending}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("customers.new_per_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {newMonthlyCustomers.map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">{m.label}</span>
                  <div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded transition-all"
                      style={{
                        width: `${Math.max(
                          (m.count /
                            Math.max(...newMonthlyCustomers.map((x) => x.count), 1)) *
                            100,
                          m.count > 0 ? 4 : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("customers.top_customers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("customers.customer")}</th>
                  <th className="text-right py-2 font-medium">{t("customers.orders_col")}</th>
                  <th className="text-right py-2 font-medium">{t("customers.total_col")}</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((tc) => {
                  const user = userMap.get(tc.userId!);
                  return (
                    <tr key={tc.userId} className="border-b hover:bg-slate-50">
                      <td className="py-2">
                        <p className="font-medium text-xs">
                          {user?.companyName || user?.name || tc.userId?.slice(0, 8)}
                        </p>
                        {user?.b2bStatus === "APPROVED" && (
                          <Badge variant="outline" className="text-xs h-4">B2B</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right text-xs">{tc._count._all}</td>
                      <td className="py-2 text-right font-medium text-xs">
                        {formatMoney(Number(tc._sum.total ?? 0), { locale, currency })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
