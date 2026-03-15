"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateOrderPDF } from "@/lib/pdf-generator";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface OrderAddress {
  street?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

interface OrderForInvoice {
  id: string;
  orderNumber?: string;
  createdAt: string | Date;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  shippingAddress?: OrderAddress | null;
  billingAddress?: OrderAddress | null;
  items: {
    name: string | null;
    sku?: string;
    quantity: number;
    price: number;
    variant?: {
      sku?: string;
      product?: { content?: Record<string, unknown>; slug?: string };
    };
  }[];
}

interface OrderInvoiceButtonProps {
  order: OrderForInvoice;
}

export function OrderInvoiceButton({ order }: OrderInvoiceButtonProps) {
  const t = useTranslations("orders");
  const handleDownload = () => {
    try {
      // Map Order to OrderPDFData
      // Try to find billing address, then shipping
      const billingAddress = order.billingAddress || order.shippingAddress;
      
      const addressStr = billingAddress
        ? [
            billingAddress.street,
            billingAddress.city,
            billingAddress.zipCode,
            billingAddress.country
          ].filter(Boolean).join(", ")
        : "";

      generateOrderPDF({
        type: "INVOICE", // B2C orders are effectively invoices when delivered
        orderNumber: order.orderNumber || order.id.slice(0, 8),
        date: new Date(order.createdAt),
        status: order.status,
        entity: {
          title: "Customer",
          name: billingAddress?.firstName && billingAddress?.lastName 
            ? `${billingAddress.firstName} ${billingAddress.lastName}`
            : "Customer",
          email: "", // User email might not be directly on address, but on order.user (if included)
          company: billingAddress?.company,
          address: addressStr,
          taxId: "", // B2C usually doesn't have taxId on address unless added
        },
        items: order.items.map((item) => {
           // Try to get product name
           let productName = item.name;
           if (!productName && item.variant?.product?.content) {
             const content = item.variant.product.content as Record<string, Record<string, string> | string>;
             productName = (content.name as string) || (content.en as Record<string, string>)?.name || (content.es as Record<string, string>)?.name || item.variant.product.slug || "";
           }

           return {
            sku: item.variant?.sku || item.sku || "N/A",
            name: productName || "Product",
            quantity: item.quantity,
            price: Number(item.price),
            total: Number(item.price) * item.quantity,
           };
        }),
        totals: {
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          total: Number(order.total),
          // For B2C, usually paid immediately
          paid: Number(order.total), 
          balance: 0,
        },
      });
      
      toast.success(t("invoice_downloaded"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("invoice_download_error"));
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      {t("download_invoice")}
    </Button>
  );
}
