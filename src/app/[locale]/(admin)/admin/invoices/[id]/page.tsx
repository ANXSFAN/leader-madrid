import { getInvoice, verifyInvoice } from "@/lib/actions/invoice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { InvoiceActions } from "@/components/admin/invoice-actions";
import { RectificativaButton } from "@/components/admin/rectificativa-button";
import { CancelInvoiceButton } from "@/components/admin/cancel-invoice-button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { getItemProductName, getItemSku } from "@/lib/utils/product-snapshot";
import { serializeDecimal } from "@/lib/serialize";

interface InvoiceDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function InvoiceDetailsPage(props: InvoiceDetailsPageProps) {
  const params = await props.params;
  const [invoice, settings, locale, t] = await Promise.all([
    getInvoice(params.id),
    getSiteSettings(),
    getLocale(),
    getTranslations("admin.invoices"),
  ]);
  const currency = settings.currency;

  if (!invoice) {
    notFound();
  }

  const integrityResult = invoice.integrityHash
    ? await verifyInvoice(invoice.id)
    : null;

  const remainingAmount =
    Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/invoices">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {t("detail.title", { number: invoice.invoiceNumber })}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-muted-foreground">
                {t("detail.issued")} {format(invoice.issueDate, "yyyy-MM-dd")}
              </span>
              <span className="text-muted-foreground">•</span>
              <span
                className={cn(
                  new Date(invoice.dueDate) < new Date() &&
                    invoice.status !== "PAID"
                    ? "text-red-500 font-bold"
                    : "text-muted-foreground"
                )}
              >
                {t("detail.due")} {format(invoice.dueDate, "yyyy-MM-dd")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <InvoiceActions invoice={serializeDecimal(invoice)} settings={settings} />

          {invoice.status !== "CANCELLED" && invoice.invoiceType !== "RECTIFICATIVA" && (
            <RectificativaButton invoiceId={invoice.id} />
          )}

          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <RecordPaymentDialog
              key={remainingAmount}
              invoiceId={invoice.id}
              remainingAmount={remainingAmount > 0 ? remainingAmount : 0}
            />
          )}

          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <CancelInvoiceButton invoiceId={invoice.id} />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.details_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">{t("detail.status")}</span>
                <Badge
                  variant={
                    invoice.status === "PAID"
                      ? "default"
                      : invoice.status === "OVERDUE" ||
                          invoice.status === "CANCELLED"
                        ? "destructive"
                        : invoice.status === "PARTIALLY_PAID"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {t(`status.${invoice.status}`)}
                </Badge>
              </div>
              {invoice.invoiceType && invoice.invoiceType !== "STANDARD" && (
                <div className="flex justify-between">
                  <span className="font-semibold">Type</span>
                  <Badge variant={
                    invoice.invoiceType === "RECTIFICATIVA" ? "destructive" : "secondary"
                  }>
                    {invoice.invoiceType === "RECTIFICATIVA"
                      ? "Factura Rectificativa"
                      : "Factura Simplificada"}
                  </Badge>
                </div>
              )}
              {invoice.originalInvoiceId && (
                <div className="flex justify-between">
                  <span className="font-semibold">Rectifies</span>
                  <Link
                    href={`/admin/invoices/${invoice.originalInvoiceId}`}
                    className="underline text-blue-600"
                  >
                    {invoice.originalInvoice?.invoiceNumber || "Original invoice"}
                  </Link>
                </div>
              )}
              {invoice.rectificationReason && (
                <div className="flex justify-between">
                  <span className="font-semibold">Reason</span>
                  <span className="text-sm text-right max-w-[60%]">{invoice.rectificationReason}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-semibold">{t("detail.sales_order")}</span>
                <Link
                  href={`/admin/sales-orders/${invoice.salesOrderId}`}
                  className="underline text-blue-600"
                >
                  {invoice.salesOrder.orderNumber}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">{t("detail.customer")}</span>
                <span>
                  {invoice.customer.companyName || invoice.customer.name} (
                  {invoice.customer.email})
                </span>
              </div>
              {invoice.vatRate != null && (
                <div className="flex justify-between">
                  <span className="font-semibold">VAT Rate</span>
                  <span>{Number(invoice.vatRate)}%{invoice.isReverseCharge ? " (Reverse Charge)" : ""}</span>
                </div>
              )}
              {invoice.buyerVatNumber && (
                <div className="flex justify-between">
                  <span className="font-semibold">Buyer VAT</span>
                  <span>{invoice.buyerVatNumber}</span>
                </div>
              )}
              {/* Integrity verification */}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Integrity</span>
                {integrityResult === null ? (
                  <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    <ShieldAlert className="h-4 w-4" />
                    Legacy (no hash)
                  </span>
                ) : integrityResult.valid ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <ShieldX className="h-4 w-4" />
                    TAMPERED
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.items_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t("detail.product")}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        {t("detail.qty")}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        {t("detail.price")}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        {t("detail.total_col")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {invoice.salesOrder.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <td className="p-4 align-middle">
                          {getItemProductName(item, locale)}
                          <div className="text-xs text-muted-foreground">
                            {getItemSku(item)}
                          </div>
                        </td>
                        <td className="p-4 align-middle text-right">
                          {item.quantity}
                        </td>
                        <td className="p-4 align-middle text-right">
                          {formatMoney(Number(item.unitPrice), { locale, currency })}
                        </td>
                        <td className="p-4 align-middle text-right">
                          {formatMoney(Number(item.total), { locale, currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.summary_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("detail.total_amount")}</span>
                <span>{formatMoney(Number(invoice.totalAmount), { locale, currency })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t("detail.paid_amount")}</span>
                <span>{formatMoney(Number(invoice.paidAmount), { locale, currency })}</span>
              </div>
              <div className="border-t my-2 pt-2 flex justify-between font-bold text-xl">
                <span>{t("detail.balance_due")}</span>
                <span
                  className={
                    remainingAmount > 0 ? "text-red-600" : "text-green-600"
                  }
                >
                  {formatMoney(remainingAmount, { locale, currency })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.payments_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length > 0 ? (
                <div className="space-y-4">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex justify-between items-center border-b pb-2 last:border-0"
                    >
                      <div>
                        <div className="font-medium">
                          {formatMoney(Number(payment.amount), { locale, currency })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(payment.date, "MMM d, yyyy HH:mm")} •{" "}
                          {payment.method}
                        </div>
                        {payment.note && (
                          <div className="text-xs italic text-muted-foreground">
                            {payment.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t("detail.no_payments")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
