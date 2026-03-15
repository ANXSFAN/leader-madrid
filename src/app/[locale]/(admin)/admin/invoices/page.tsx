import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { getInvoices } from "@/lib/actions/invoice";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney, formatDate } from "@/lib/formatters";
import { labelCode } from "@/lib/i18n-labels";
import { PageHeader } from "@/components/admin/page-header";
import { InvoiceExportButton } from "@/components/admin/invoice-export-button";

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.invoices"),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        actions={<InvoiceExportButton />}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.invoice_number")}</TableHead>
              <TableHead>{t("table.sales_order")}</TableHead>
              <TableHead>{t("table.customer")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.total")}</TableHead>
              <TableHead>{t("table.paid")}</TableHead>
              <TableHead>{t("table.due_date")}</TableHead>
              <TableHead>{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {inv.invoiceNumber}
                    {inv.invoiceType === "RECTIFICATIVA" && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">RECT</Badge>
                    )}
                    {inv.invoiceType === "SIMPLIFICADA" && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">SIMPL</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/sales-orders/${inv.salesOrderId}`}
                    className="underline hover:text-blue-600"
                  >
                    {inv.salesOrder?.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {inv.customer.companyName ||
                    inv.customer.name ||
                    inv.customer.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      inv.status === "PAID"
                        ? "default"
                        : inv.status === "OVERDUE" || inv.status === "CANCELLED"
                          ? "destructive"
                          : inv.status === "PARTIALLY_PAID"
                            ? "secondary"
                            : "outline"
                    }
                    className={cn(
                      inv.status === "PAID" &&
                        "bg-green-600 hover:bg-green-700",
                      inv.status === "PARTIALLY_PAID" &&
                        "bg-yellow-500 hover:bg-yellow-600 text-white"
                    )}
                  >
                    {labelCode(t, "status", inv.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatMoney(Number(inv.totalAmount), { locale, currency })}
                </TableCell>
                <TableCell>
                  {formatMoney(Number(inv.paidAmount), { locale, currency })}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      new Date(inv.dueDate) < new Date() &&
                        inv.status !== "PAID" &&
                        "text-red-500 font-bold"
                    )}
                  >
                    {formatDate(inv.dueDate, { locale, dateStyle: "medium" })}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/invoices/${inv.id}`}>
                    <Button variant="ghost" size="sm">
                      {t("actions.view")}
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
