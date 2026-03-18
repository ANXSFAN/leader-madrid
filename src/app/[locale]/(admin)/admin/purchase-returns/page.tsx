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
import { getPurchaseReturns } from "@/lib/actions/purchase-return";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { PageHeader } from "@/components/admin/page-header";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  DRAFT: "outline",
  CONFIRMED: "secondary",
  SHIPPED_TO_SUPPLIER: "secondary",
  RECEIVED_BY_SUPPLIER: "default",
  REFUNDED: "default",
  CANCELLED: "destructive",
};

export default async function PurchaseReturnsPage() {
  const [locale, settings, t, returns] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.purchaseReturns"),
    getPurchaseReturns(),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/purchase-returns/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.create")}
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.return_number")}</TableHead>
              <TableHead>{t("table.po_number")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
              <TableHead>{t("table.warehouse")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.amount")}</TableHead>
              <TableHead>{t("table.created_at")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((pr) => (
              <TableRow key={pr.id}>
                <TableCell className="font-medium">{pr.returnNumber}</TableCell>
                <TableCell>
                  <Link href={`/admin/purchase-orders/${pr.purchaseOrderId}`} className="text-blue-600 hover:underline">
                    {pr.purchaseOrder.poNumber}
                  </Link>
                </TableCell>
                <TableCell>{pr.supplier.name}</TableCell>
                <TableCell>{pr.warehouse.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[pr.status] || "outline"}>
                    {pr.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{formatMoney(pr.totalAmount, { locale, currency })}</TableCell>
                <TableCell>{format(pr.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/purchase-returns/${pr.id}`}>
                      {t("table.view")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {returns.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                  {t("table.no_returns")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
