import { getReturnRequests } from "@/lib/actions/returns";
import { ReturnStatus } from "@prisma/client";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RotateCcw } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { labelCode } from "@/lib/i18n-labels";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<ReturnStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  RECEIVED: "bg-purple-100 text-purple-800",
  REFUNDED: "bg-green-100 text-green-800",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default async function ReturnsAdminPage() {
  const [{ items: returns, total }, locale, t] = await Promise.all([
    getReturnRequests(),
    getLocale(),
    getTranslations("admin.returns"),
  ]);

  const pending = returns.filter((r) =>
    ["REQUESTED", "APPROVED", "RECEIVED"].includes(r.status)
  ).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex gap-3">
            <Card className="py-2 px-4">
              <p className="text-xs text-muted-foreground">{t("stats.total")}</p>
              <p className="text-xl font-bold">{total}</p>
            </Card>
            <Card className="py-2 px-4">
              <p className="text-xs text-muted-foreground">{t("stats.active")}</p>
              <p className="text-xl font-bold text-amber-600">{pending}</p>
            </Card>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("table.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {returns.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {t("empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 pr-4 font-medium">{t("table.return_number")}</th>
                    <th className="text-left py-3 pr-4 font-medium">{t("table.order")}</th>
                    <th className="text-left py-3 pr-4 font-medium">{t("table.customer")}</th>
                    <th className="text-left py-3 pr-4 font-medium">{t("table.reason")}</th>
                    <th className="text-left py-3 pr-4 font-medium">{t("table.status")}</th>
                    <th className="text-left py-3 pr-4 font-medium">{t("table.date")}</th>
                    <th className="py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret) => (
                    <tr key={ret.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-mono font-medium text-xs">
                        {ret.returnNumber}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs">{ret.order.orderNumber}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{ret.user.companyName || ret.user.name}</p>
                        <p className="text-xs text-muted-foreground">{ret.user.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs">{labelCode(t, "reason", ret.reason)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            STATUS_COLORS[ret.status]
                          }`}
                        >
                          {labelCode(t, "status", ret.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {new Date(ret.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td className="py-3">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/returns/${ret.id}`}>{t("actions.view")}</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
