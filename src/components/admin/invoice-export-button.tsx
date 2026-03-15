"use client";

import { useState } from "react";
import { Loader2, FileSpreadsheet, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { exportInvoices } from "@/lib/actions/invoice";

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

export function InvoiceExportButton() {
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingXml, setLoadingXml] = useState(false);
  const t = useTranslations("admin.invoices");

  const handleExport = async (format: "csv" | "xml") => {
    const setLoading = format === "csv" ? setLoadingCsv : setLoadingXml;
    setLoading(true);
    try {
      const result = await exportInvoices(format);
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("csv")}
        disabled={loadingCsv}
      >
        {loadingCsv ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {t("export.csv")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("xml")}
        disabled={loadingXml}
      >
        {loadingXml ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileCode className="mr-2 h-4 w-4" />
        )}
        {t("export.xml")}
      </Button>
    </div>
  );
}
