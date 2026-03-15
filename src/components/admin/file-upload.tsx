"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  uploadPath?: string;
}

export function FileUpload({
  value,
  onChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx",
  uploadPath = "cms-documents",
}: FileUploadProps) {
  const t = useTranslations("admin.cms.fileUpload");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", uploadPath);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      toast.success(t("file_uploaded"));
    } catch {
      toast.error(t("upload_failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (value) {
    const fileName = value.split("/").pop() || "Document";
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
        <FileText className="h-8 w-8 text-yellow-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-yellow-600 hover:underline flex items-center gap-1"
          >
            {t("open")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onChange("")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {uploading ? t("uploading") : t("upload_file")}
      </Button>
    </div>
  );
}
