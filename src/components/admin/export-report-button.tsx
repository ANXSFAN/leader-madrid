"use client";

import { useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { DateRange } from "@/lib/report-utils";
import { format } from "date-fns";

type ReportType = "sales" | "inventory" | "orders" | "margins" | "procurement" | "ar";
type ExportFormat = "csv" | "xlsx" | "pdf";

interface ExportReportButtonProps {
  type: ReportType;
  dateRange?: DateRange;
}

export function ExportReportButton({ type, dateRange }: ExportReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const t = useTranslations("admin.reports.export");

  async function handleExport(fmt: ExportFormat) {
    setLoading(true);
    setShowMenu(false);
    try {
      let url = `/api/reports/export?type=${type}&format=${fmt}`;
      if (dateRange) {
        url += `&from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        toast.error(t("error"));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${type}-report.${fmt}`;

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);

      toast.success(t("success"));
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }

  const formats: { key: ExportFormat; label: string }[] = [
    { key: "csv", label: "CSV" },
    { key: "xlsx", label: "Excel" },
    { key: "pdf", label: "PDF" },
  ];

  return (
    <div className="relative">
      <div className="flex items-center gap-0">
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-r-none"
          onClick={() => handleExport("csv")}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          {t("export")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-l-none border-l-0 px-1.5"
          onClick={() => setShowMenu(!showMenu)}
          disabled={loading}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-md z-50 min-w-[100px]">
          {formats.map((f) => (
            <button
              key={f.key}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 transition-colors"
              onClick={() => handleExport(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
