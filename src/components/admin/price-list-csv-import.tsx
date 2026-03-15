"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { batchImportPriceListRules } from "@/lib/actions/price-list";
import { toast } from "sonner";

interface PriceListCsvImportProps {
  priceListId: string;
}

export function PriceListCsvImport({ priceListId }: PriceListCsvImportProps) {
  const t = useTranslations("admin.priceLists.csvImport");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    const csv = "sku,price,min_quantity\nLED-EXAMPLE-001,12.50,1\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-list-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await batchImportPriceListRules(priceListId, formData);

      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }

      const data = res as { imported: number; skipped: number; errors: string[] };
      setResult({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors,
      });

      if (data.imported > 0) {
        toast.success(t("import_success", { count: data.imported }));
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 border-l-4 border-yellow-500 pl-3">
          <Upload className="h-5 w-5" />
          {t("import_title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("import_desc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
          >
            <Download className="h-4 w-4 mr-1" />
            {t("download_template")}
          </Button>
        </div>

        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="bg-yellow-500 hover:bg-yellow-600 text-black"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("importing")}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {t("import_button")}
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-2 pt-2">
            {result.imported > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {t("import_success", { count: result.imported })}
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {t("import_errors", { count: result.errors.length })}
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-6 list-disc max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
