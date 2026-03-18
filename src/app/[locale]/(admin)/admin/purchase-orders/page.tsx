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
import { getPurchaseOrders } from "@/lib/actions/purchase-order";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { PageHeader } from "@/components/admin/page-header";

export default async function PurchaseOrdersPage() {
  const [locale, settings, t, pos] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.purchaseOrders"),
    getPurchaseOrders(),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/purchase-orders/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.create")}
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.po_number")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.total")}</TableHead>
              <TableHead>{t("table.created_at")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      po.status === "RECEIVED"
                        ? "default"
                        : po.status === "CANCELLED"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {t(`status.${po.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{formatMoney(po.totalAmount, { locale, currency })}</TableCell>
                <TableCell>{format(po.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/purchase-orders/${po.id}`}>
                      {t("table.view")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {pos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {t("table.no_orders")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
