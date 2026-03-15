"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { importProducts, exportProducts } from "@/lib/actions/import-export";
import { Loader2, Upload, FileDown, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ImportProductsDialog() {
  const t = useTranslations("admin.import_products");
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    errors: string[];
  } | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const res = await exportProducts();
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
        a.download = res.filename || "products_template.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(t("toast_success", { count: 0 }).replace(" 0 ", " "));
      } else {
        toast.error(res.error || t("toast_dl_failed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("toast_dl_error"));
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await importProducts(formData);
      setResult(res);
      if (res.success) {
        toast.success(t("toast_success", { count: res.count }));
        if (res.errors.length > 0) {
          toast.warning(t("toast_with_errors", { count: res.errors.length }));
        } else {
          setIsOpen(false);
        }
      } else {
        toast.error(t("toast_failed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("toast_error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="border-l-4 border-yellow-500 pl-3">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <Label>{t("template_label")}</Label>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileDown className="mr-2 h-4 w-4" /> {t("download_template")}
            </Button>
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="file">{t("file_label")}</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {result && (
            <Alert variant={result.errors.length > 0 ? "destructive" : "default"}>
              {result.errors.length > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.success ? t("result_completed") : t("result_failed")}
              </AlertTitle>
              <AlertDescription>
                <p>{t("result_processed", { count: result.count })}</p>
                {result.errors.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto text-xs">
                    <p className="font-semibold mb-1">{t("result_errors_label")}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleImport} disabled={!file || uploading} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
