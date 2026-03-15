"use client";

import { useState } from "react";
import {
  PurchaseOrder,
  Supplier,
  PurchaseOrderItem,
  ProductVariant,
  Product,
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
import { updatePOStatus } from "@/lib/actions/purchase-order";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Send, Download, Shield } from "lucide-react";
import { generateOrderPDF } from "@/lib/pdf-generator";
import { useTranslations } from "next-intl";
import { getItemProductName, getItemSku } from "@/lib/utils/product-snapshot";

type POWithDetails = PurchaseOrder & {
  supplier: Supplier;
  items: (PurchaseOrderItem & {
    variant: ProductVariant & {
      product: Product;
    };
  })[];
};

interface PurchaseOrderDetailsProps {
  po: POWithDetails;
}

export function PurchaseOrderDetails({ po }: PurchaseOrderDetailsProps) {
  const router = useRouter();
  const t = useTranslations("admin.purchaseOrders");
  const [loading, setLoading] = useState(false);

  const handleDownloadPDF = () => {
    const supplierContact = po.supplier.contact as any;
    const supplierAddress = po.supplier.address as any;

    let addressStr = "";
    if (typeof supplierAddress === "string") {
      addressStr = supplierAddress;
    } else if (supplierAddress) {
      addressStr = [
        supplierAddress.street,
        supplierAddress.city,
        supplierAddress.state,
        supplierAddress.zipCode,
        supplierAddress.country,
      ]
        .filter(Boolean)
        .join(", ");
    }

    generateOrderPDF({
      type: "PURCHASE_ORDER",
      orderNumber: po.poNumber,
      date: new Date(po.createdAt),
      status: po.status,
      entity: {
        title: t("detail.pdf_entity"),
        name: po.supplier.name,
        email: supplierContact?.email,
        company: po.supplier.code,
        address: addressStr,
        taxId: supplierContact?.taxId || supplierAddress?.taxId,
      },
      items: po.items.map((item) => ({
        sku: getItemSku(item),
        name: getItemProductName(item),
        quantity: item.quantity,
        price: Number(item.costPrice),
        total: Number(item.total),
      })),
      totals: {
        subtotal: Number(po.totalAmount),
        total: Number(po.totalAmount),
      },
    });
  };

  const handleStatusChange = async (
    status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED"
  ) => {
    if (!confirm(t("detail.confirm_status", { status }))) return;

    try {
      setLoading(true);
      const result = await updatePOStatus(po.id, status);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{po.poNumber}</h2>
            <p className="text-muted-foreground">
              {t("detail.created_on", { date: format(new Date(po.createdAt), "PPP") })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" /> {t("detail.download_pdf")}
          </Button>
          {po.status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("CANCELLED")} disabled={loading}>
                <XCircle className="mr-2 h-4 w-4" /> {t("detail.cancel")}
              </Button>
              <Button onClick={() => handleStatusChange("SENT")} disabled={loading}>
                <Send className="mr-2 h-4 w-4" /> {t("detail.mark_sent")}
              </Button>
            </>
          )}
          {po.status === "SENT" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("CANCELLED")} disabled={loading}>
                <XCircle className="mr-2 h-4 w-4" /> {t("detail.cancel")}
              </Button>
              <Button onClick={() => handleStatusChange("RECEIVED")} disabled={loading} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" /> {t("detail.receive_items")}
              </Button>
            </>
          )}
          {po.status === "RECEIVED" && (
            <Badge variant="default" className="bg-green-600 text-lg px-4 py-1">
              {t("status.RECEIVED")}
            </Badge>
          )}
          {po.status === "CANCELLED" && (
            <Badge variant="destructive" className="text-lg px-4 py-1">
              {t("status.CANCELLED")}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.supplier_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.name")}</dt>
                <dd className="font-medium">{po.supplier.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.code")}</dt>
                <dd className="font-medium">{po.supplier.code}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.contact")}</dt>
                <dd className="font-medium">
                  {JSON.stringify(po.supplier.contact)}
                </dd>
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
                <dd className="font-medium">{po.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("detail.total_amount")}</dt>
                <dd className="font-medium text-lg">
                  €{Number(po.totalAmount).toFixed(2)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {(po.customsDeclarationNumber || po.customsClearedAt || po.dutyAmount || po.customsServiceFee || po.customsNotes) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("customs.section_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {po.customsDeclarationNumber && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("customs.declaration_number")}</dt>
                  <dd className="font-medium">{po.customsDeclarationNumber}</dd>
                </div>
              )}
              {po.customsClearedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("customs.cleared_at")}</dt>
                  <dd className="font-medium">{format(new Date(po.customsClearedAt), "PPP")}</dd>
                </div>
              )}
              {po.dutyAmount && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("customs.duty_amount")}</dt>
                  <dd className="font-medium">{Number(po.dutyAmount).toFixed(2)} {po.currency}</dd>
                </div>
              )}
              {po.customsServiceFee && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("customs.service_fee")}</dt>
                  <dd className="font-medium">{Number(po.customsServiceFee).toFixed(2)} {po.currency}</dd>
                </div>
              )}
              {(po.dutyAmount || po.customsServiceFee) && (
                <div className="flex justify-between col-span-full border-t pt-2">
                  <dt className="text-muted-foreground font-semibold">{t("customs.total_customs_cost")}</dt>
                  <dd className="font-bold">{(Number(po.dutyAmount || 0) + Number(po.customsServiceFee || 0)).toFixed(2)} {po.currency}</dd>
                </div>
              )}
              {po.customsNotes && (
                <div className="col-span-full">
                  <dt className="text-muted-foreground mb-1">{t("customs.notes")}</dt>
                  <dd className="font-medium whitespace-pre-wrap">{po.customsNotes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

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
                <TableHead className="text-right">{t("detail.cost_price")}</TableHead>
                <TableHead className="text-right">{t("detail.quantity")}</TableHead>
                <TableHead className="text-right">{t("detail.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{getItemSku(item)}</TableCell>
                  <TableCell>
                    {getItemProductName(item)}
                  </TableCell>
                  <TableCell className="text-right">€{Number(item.costPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">€{Number(item.total).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
