"use client";

import { InvoiceActions } from "@/components/admin/invoice-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteSettingsData } from "@/lib/actions/config";
import { format } from "date-fns";
import {
  Invoice,
  User,
  SalesOrder,
  SalesOrderItem,
  ProductVariant,
  Product,
  Address,
} from "@prisma/client";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/formatters";

type InvoiceWithRelations = Invoice & {
  customer: User & {
    addresses?: Address[];
  };
  salesOrder: SalesOrder & {
    items: (SalesOrderItem & {
      variant: ProductVariant & {
        product: Product;
      };
    })[];
  };
};

interface InvoiceListProps {
  invoices: InvoiceWithRelations[];
  settings: SiteSettingsData;
}

export function InvoiceList({ invoices, settings }: InvoiceListProps) {
  const t = useTranslations("profile.invoices");
  const locale = useLocale();

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("col_number")}</TableHead>
            <TableHead>{t("col_date")}</TableHead>
            <TableHead>{t("col_amount")}</TableHead>
            <TableHead>{t("col_status")}</TableHead>
            <TableHead className="text-right">{t("col_actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-10 text-muted-foreground"
              >
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.invoiceNumber}
                </TableCell>
                <TableCell>
                  {format(new Date(invoice.issueDate), "PPP")}
                </TableCell>
                <TableCell>
                  {formatMoney(invoice.totalAmount, {
                    locale,
                    currency: invoice.currency || settings.currency || "EUR",
                  })}
                </TableCell>
                <TableCell>
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
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <InvoiceActions invoice={invoice} settings={settings} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
