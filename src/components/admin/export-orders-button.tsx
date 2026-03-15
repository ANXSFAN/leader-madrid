"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportOrders } from "@/lib/actions/import-export";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ExportOrdersButton() {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.orders");

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await exportOrders();
      if (res.success && res.data) {
        const byteCharacters = atob(res.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "orders_export.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(t("actions.export_success"));
      } else {
        toast.error(res.error || t("actions.export_error"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("actions.export_error"));
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
      {t("actions.export")}
    </Button>
  );
}
