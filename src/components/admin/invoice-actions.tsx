"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet, FileCode, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import InvoicePDF from "@/components/documents/invoice-pdf";
import {
  Invoice,
  User,
  SalesOrder,
  SalesOrderItem,
  ProductVariant,
  Product,
  Address,
} from "@prisma/client";
import { SiteSettingsData } from "@/lib/actions/config";
import { exportInvoices } from "@/lib/actions/invoice";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import QRCode from "qrcode";

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

interface InvoiceActionsProps {
  invoice: InvoiceWithRelations;
  settings: SiteSettingsData;
}

function triggerDownload(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function InvoiceActions({ invoice, settings }: InvoiceActionsProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingXml, setLoadingXml] = useState(false);
  const t = useTranslations("admin.invoices");
  const locale = useLocale();

  const handleDownloadPDF = async () => {
    setLoadingPdf(true);
    try {
      // Generate QR code if VeriFactu data is available
      let qrCodeDataUrl: string | undefined;
      const verifactuQrData = (invoice as any).verifactuQrData;
      if (verifactuQrData) {
        try {
          qrCodeDataUrl = await QRCode.toDataURL(verifactuQrData, {
            width: 120,
            margin: 1,
            errorCorrectionLevel: "M",
          });
        } catch (e) {
          console.error("QR code generation failed:", e);
        }
      }

      const blob = await pdf(
        <InvoicePDF invoice={invoice} settings={settings} locale={locale} qrCodeDataUrl={qrCodeDataUrl} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("export.error"));
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExport = async (format: "csv" | "xml") => {
    const setLoading = format === "csv" ? setLoadingCsv : setLoadingXml;
    setLoading(true);
    try {
      // Export single invoice by using its issue date as both from/to
      const dateStr = invoice.issueDate
        ? new Date(invoice.issueDate).toISOString().slice(0, 10)
        : undefined;
      const result = await exportInvoices(format, dateStr, dateStr);
      if (!result.success || !result.data) {
        toast.error(result.error || t("export.error"));
        return;
      }
      triggerDownload(result.data, result.filename!, result.mimeType!);
      toast.success(t("export.success"));
    } catch {
      toast.error(t("export.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleDownloadPDF} disabled={loadingPdf}>
        {loadingPdf ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Printer className="mr-2 h-4 w-4" />
        )}
        {t("detail.print_pdf")}
      </Button>
      <Button variant="outline" onClick={() => handleExport("csv")} disabled={loadingCsv}>
        {loadingCsv ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        CSV
      </Button>
      <Button variant="outline" onClick={() => handleExport("xml")} disabled={loadingXml}>
        {loadingXml ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileCode className="mr-2 h-4 w-4" />
        )}
        DATEV XML
      </Button>
    </div>
  );
}
