"use client";

import React, { useState } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStorageUrls } from "@/lib/utils/storage-cleanup";

interface SingleImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function SingleImageUpload({ value, onChange, label = "Image" }: SingleImageUploadProps) {
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "images");
      formData.append("path", "categories");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const addUrl = () => {
    if (!urlInput) return;
    onChange(urlInput);
    setUrlInput("");
    toast.success("Image URL added");
  };

  const removeImage = () => {
    if (value) {
      deleteStorageUrls([value]);
    }
    onChange("");
  };

  return (
    <div className="space-y-4">
      {!value ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label>
                Upload Image
                {isUploading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="grid w-full gap-1.5">
                <Label>Or Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/image.jpg"
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
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative group border rounded-lg overflow-hidden bg-slate-100 inline-block">
          <NextImage
            src={value}
            alt="Category"
            width={128}
            height={128}
            className="h-32 w-32 object-contain bg-slate-50"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
