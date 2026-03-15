"use client";

import React, { useState, useRef, useCallback } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStorageUrls } from "@/lib/utils/storage-cleanup";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface LogoUploadProps {
  value: string;
  onChange: (value: string) => void;
}

export function LogoUpload({ value, onChange }: LogoUploadProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("admin.cms.siteInfo");

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "images");
      formData.append("path", "site");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();

      // Clean up old logo from storage if it exists
      if (value) {
        deleteStorageUrls([value]);
      }

      onChange(data.url);
      toast.success(t("logo_upload_success"));
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error(t("logo_upload_error"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        await uploadFile(file);
      }
    },
    [value]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addUrl = () => {
    if (!urlInput) return;
    // Clean up old logo from storage if it exists
    if (value) {
      deleteStorageUrls([value]);
    }
    onChange(urlInput);
    setUrlInput("");
    toast.success(t("logo_url_added"));
  };

  const removeLogo = () => {
    // Clean up from storage
    if (value) {
      deleteStorageUrls([value]);
    }
    onChange("");
  };

  if (value) {
    return (
      <div className="space-y-2">
        <Label>{t("fields.logo_url")}</Label>
        <div className="relative group border rounded-lg overflow-hidden bg-muted inline-block p-3">
          <NextImage
            src={value}
            alt="Logo"
            width={200}
            height={80}
            className="h-16 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <button
            type="button"
            onClick={removeLogo}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground truncate max-w-md">{value}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>{t("fields.logo_url")}</Label>
      <p className="text-sm text-muted-foreground">{t("fields.logo_url_desc")}</p>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
            mode === "upload"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("logo_tab_upload")}
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
            mode === "url"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          {t("logo_tab_url")}
        </button>
      </div>

      {mode === "upload" ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors",
            isDragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50 bg-muted/10",
            isUploading && "pointer-events-none opacity-60"
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-accent animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">{t("logo_uploading")}</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("logo_drag_hint")}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                PNG, JPG, SVG, WebP
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/logo.png"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addUrl}>
            <Upload className="h-4 w-4 mr-2" />
            {t("logo_add_url")}
          </Button>
        </div>
      )}
    </div>
  );
}
