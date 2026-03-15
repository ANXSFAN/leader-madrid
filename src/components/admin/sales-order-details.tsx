"use client";

import { useState } from "react";
import {
  SalesOrder,
  User,
  SalesOrderItem,
  ProductVariant,
  Product,
  Invoice,
  ShippingMethod,
  Address,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { updateSOStatus } from "@/lib/actions/sales-order";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Truck,
  Download,
  FileText,
  CheckCheck,
} from "lucide-react";
import { generateOrderPDF } from "@/lib/pdf-generator";
import { CreateInvoiceButton } from "@/components/admin/create-invoice-button";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/formatters";
import { getItemProductName, getItemSku } from "@/lib/utils/product-snapshot";

type SOWithDetails = SalesOrder & {
  customer: User & {
    addresses: Address[];
  };
  items: (SalesOrderItem & {
    variant: ProductVariant & {
      product: Product;
    };
  })[];
  invoices?: Invoice[];
  shippingMethod?: ShippingMethod | null;
};

interface SalesOrderDetailsProps {
  so: SOWithDetails;
  currency?: string;
}

export function SalesOrderDetails({ so, currency = "EUR" }: SalesOrderDetailsProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin.salesOrders");
  const [loading, setLoading] = useState(false);
  const fmt = (amount: number | string) => formatMoney(amount, { locale, currency });

  const handleDownloadPDF = () => {
    const billingAddress = so.customer.addresses?.find((a) => a.type === "BILLING");
    const shippingAddress = so.customer.addresses?.find((a) => a.type === "SHIPPING");
    const address = billingAddress || shippingAddress || so.customer.addresses?.[0];

    let addressStr = "";
    if (address) {
      addressStr = [address.street, address.city, address.state, address.zipCode, address.country]
        .filter(Boolean)
        .join(", ");
    }

    generateOrderPDF({
      type: "SALES_ORDER",
      orderNumber: so.orderNumber,
      date: new Date(so.createdAt),
      status: so.status,
      entity: {
        title: t("detail.pdf_entity"),
        name: so.customer.name || t("detail.guest"),
        email: so.customer.email,
        company: so.customer.companyName,
        address: addressStr,
        taxId: so.customer.taxId,
      },
      items: so.items.map((item) => ({
        sku: getItemSku(item),
        name: getItemProductName(item, locale),
        quantity: item.quantity,
        price: Number(item.unitPrice),
        total: Number(item.total),
      })),
      totals: {
        subtotal: Number(so.totalAmount),
        total: Number(so.totalAmount),
      },
    });
  };

  const handleStatusChange = async (
    status: "DRAFT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED"
  ) => {
    if (!confirm(t("detail.confirm_status", { status }))) return;

    try {
      setLoading(true);
      const result = await updateSOStatus(so.id, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("detail.status_updated", { status }));
        router.refresh();
      }
    } catch {
      toast.error(t("detail.update_error"));
    } finally {
      setLoading(false);
    }
  };

  const hasInvoice = so.invoices && so.invoices.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{so.orderNumber}</h2>
            <p className="text-muted-foreground">
              {t("detail.created_on", { date: format(new Date(so.createdAt), "PPP") })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" /> {t("detail.download_pdf")}
          </Button>
          {(so.status === "CONFIRMED" || so.status === "SHIPPED") && (
            <>
              {hasInvoice ? (
                <Link href={`/admin/invoices/${so.invoices![0].id}`}>
                  <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" /> {t("detail.view_invoice")}
                  </Button>
                </Link>
              ) : (
                <CreateInvoiceButton salesOrderId={so.id} />
              )}
            </>
          )}
          {so.status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("CANCELLED")} disabled={loading}>
                <XCircle className="mr-2 h-4 w-4" /> {t("detail.cancel")}
              </Button>
              <Button onClick={() => handleStatusChange("CONFIRMED")} disabled={loading}>
                <CheckCircle className="mr-2 h-4 w-4" /> {t("detail.confirm_order")}
              </Button>
            </>
          )}
          {so.status === "CONFIRMED" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("CANCELLED")} disabled={loading}>
                <XCircle className="mr-2 h-4 w-4" /> {t("detail.cancel")}
              </Button>
              <Button onClick={() => handleStatusChange("SHIPPED")} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <Truck className="mr-2 h-4 w-4" /> {t("detail.ship_order")}
              </Button>
            </>
          )}
          {so.status === "SHIPPED" && (
            <>
              <Badge variant="default" className="bg-blue-600 text-lg px-4 py-1 mr-4">{t("status.SHIPPED")}</Badge>
              <Button onClick={() => handleStatusChange("DELIVERED")} disabled={loading} className="bg-green-600 hover:bg-green-700">
                <CheckCheck className="mr-2 h-4 w-4" /> {t("detail.mark_delivered")}
              </Button>
            </>
          )}
          {so.status === "DELIVERED" && (
            <Badge variant="default" className="bg-green-600 text-lg px-4 py-1">{t("status.DELIVERED")}</Badge>
          )}
          {so.status === "CANCELLED" && (
            <Badge variant="destructive" className="text-lg px-4 py-1">{t("status.CANCELLED")}</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.customer_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.name")}</dt>
                <dd className="font-medium">{so.customer.name || t("detail.na")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.email")}</dt>
                <dd className="font-medium">{so.customer.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.company")}</dt>
                <dd className="font-medium">{so.customer.companyName || t("detail.na")}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.summary_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.status")}</dt>
                <dd className="font-medium">{so.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.total_amount")}</dt>
                <dd className="font-medium text-lg">{fmt(Number(so.totalAmount))}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.shipping_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.method")}</dt>
                <dd className="font-medium">{so.shippingMethod?.name || t("detail.na")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.shipping_status")}</dt>
                <dd className="font-medium">{so.shippingStatus}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.tracking")}</dt>
                <dd className="font-medium">{so.trackingNumber || t("detail.na")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.tracking_url")}</dt>
                <dd className="font-medium truncate max-w-[220px] text-right">{so.trackingUrl || t("detail.na")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.shipped_at")}</dt>
                <dd className="font-medium">{so.shippedAt ? format(new Date(so.shippedAt), "PPP") : t("detail.na")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.delivered_at")}</dt>
                <dd className="font-medium">{so.deliveredAt ? format(new Date(so.deliveredAt), "PPP") : t("detail.na")}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.items_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.sku")}</TableHead>
                <TableHead>{t("detail.product_name")}</TableHead>
                <TableHead className="text-right">{t("detail.unit_price")}</TableHead>
                <TableHead className="text-right">{t("detail.cost_price")}</TableHead>
                <TableHead className="text-right">{t("detail.quantity")}</TableHead>
                <TableHead className="text-right">{t("detail.total")}</TableHead>
                <TableHead className="text-right">{t("detail.margin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {so.items.map((item) => {
                const unitPrice = Number(item.unitPrice);
                const costPrice = item.costPrice ? Number(item.costPrice) : null;
                const itemMargin = costPrice !== null ? (unitPrice - costPrice) * item.quantity : null;
                const marginPct = costPrice !== null && unitPrice > 0 ? ((unitPrice - costPrice) / unitPrice) * 100 : null;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{getItemSku(item)}</TableCell>
                    <TableCell>
                      {getItemProductName(item, locale)}
                    </TableCell>
                    <TableCell className="text-right">{fmt(unitPrice)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {costPrice !== null ? fmt(costPrice) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{fmt(Number(item.total))}</TableCell>
                    <TableCell className="text-right">
                      {itemMargin !== null ? (
                        <span className={itemMargin >= 0 ? "text-green-600" : "text-red-600"}>
                          {fmt(itemMargin)}
                          <span className="text-xs ml-1">({marginPct!.toFixed(1)}%)</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Margin Summary */}
          {(() => {
            const totalRevenue = so.items.reduce((acc, item) => acc + Number(item.total), 0);
            const totalCost = so.items.reduce((acc, item) => {
              if (item.costPrice === null || item.costPrice === undefined) return acc;
              return acc + Number(item.costPrice) * item.quantity;
            }, 0);
            const hasCost = so.items.some((item) => item.costPrice !== null && item.costPrice !== undefined);
            const totalMargin = totalRevenue - totalCost;
            const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

            if (!hasCost) return null;

            return (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="space-y-1 text-sm text-right">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">{t("detail.total_revenue")}:</span>
                    <span className="font-medium">{fmt(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">{t("detail.total_cost")}:</span>
                    <span className="font-medium">{fmt(totalCost)}</span>
                  </div>
                  <div className="flex justify-between gap-8 pt-1 border-t">
                    <span className="font-semibold">{t("detail.gross_margin")}:</span>
                    <span className={`font-bold ${totalMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(totalMargin)} ({totalMarginPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
