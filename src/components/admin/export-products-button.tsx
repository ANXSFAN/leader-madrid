"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportProducts } from "@/lib/actions/import-export";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ExportProductsButton() {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.products.actions");

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await exportProducts();
      if (res.success && res.data) {
        // Convert base64 to Blob
        const byteCharacters = atob(res.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "products_export.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(t("export_success"));
      } else {
        toast.error(res.error || t("export_error"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("export_error_generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {t("export")}
    </Button>
  );
}
