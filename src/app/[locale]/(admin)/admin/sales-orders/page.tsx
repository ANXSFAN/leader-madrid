import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSalesOrders } from "@/lib/actions/sales-order";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";

export default async function SalesOrdersPage() {
  const [sos, t, locale, settings] = await Promise.all([
    getSalesOrders(),
    getTranslations("admin.salesOrders"),
    getLocale(),
    getSiteSettings(),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("list.title")}
        actions={
          <Link href="/admin/sales-orders/new">
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
              <Plus className="mr-2 h-4 w-4" /> {t("list.create")}
            </Button>
          </Link>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.table.order_number")}</TableHead>
              <TableHead>{t("list.table.customer")}</TableHead>
              <TableHead>{t("list.table.status")}</TableHead>
              <TableHead>{t("list.table.total")}</TableHead>
              <TableHead>{t("list.table.margin")}</TableHead>
              <TableHead>{t("list.table.created_at")}</TableHead>
              <TableHead>{t("list.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sos.map((so) => (
              <TableRow key={so.id}>
                <TableCell className="font-medium">{so.orderNumber}</TableCell>
                <TableCell>
                  {so.customer.name || so.customer.email}
                  {so.customer.companyName && (
                    <div className="text-xs text-muted-foreground">{so.customer.companyName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      so.status === "SHIPPED"
                        ? "default"
                        : so.status === "CANCELLED"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {t(`status.${so.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{formatMoney(Number(so.totalAmount), { locale, currency })}</TableCell>
                <TableCell>
                  {(() => {
                    const hasCost = so.items.some((item) => item.costPrice !== null);
                    if (!hasCost) return <span className="text-muted-foreground">—</span>;
                    const totalRevenue = so.items.reduce((acc: number, item) => acc + Number(item.unitPrice) * item.quantity, 0);
                    const totalCost = so.items.reduce((acc: number, item) => {
                      if (item.costPrice === null) return acc;
                      return acc + Number(item.costPrice) * item.quantity;
                    }, 0);
                    const margin = totalRevenue - totalCost;
                    const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
                    return (
                      <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                        {marginPct.toFixed(1)}%
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell>{format(so.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell>
                  <Link href={`/admin/sales-orders/${so.id}`}>
                    <Button variant="ghost" size="sm">
                      {t("list.table.view")}
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {sos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {t("list.table.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
