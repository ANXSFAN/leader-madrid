"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, GripVertical, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStorageUrls } from "@/lib/utils/storage-cleanup";

interface ImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const SortableImage = ({
  url,
  id,
  onRemove,
  isMain,
}: {
  url: string;
  id: string;
  onRemove: () => void;
  isMain: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group border rounded-lg overflow-hidden bg-background aspect-square ${
        isMain ? "ring-2 ring-primary" : ""
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 cursor-move p-1 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 p-1 bg-destructive/80 hover:bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Main Label */}
      {isMain && (
        <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-xs text-center py-1 font-medium">
          Main Image
        </div>
      )}

      {/* Image */}
      <Image
        src={url}
        alt="Product"
        fill
        className="object-cover"
      />
    </div>
  );
};

export function ImageUpload({ value = [], onChange }: ImageUploadProps) {
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(String(active.id));
      const newIndex = value.indexOf(String(over.id));
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "images");
        formData.append("path", "products");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        newUrls.push(data.url);
      } catch (err: any) {
        console.error("Image upload error:", err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newUrls.length > 0) {
      onChange([...value, ...newUrls]);
      toast.success(`Uploaded ${newUrls.length} image(s)`);
    }

    setUploading(false);
    e.target.value = "";
  };

  const addUrl = () => {
    if (!urlInput) return;
    onChange([...value, urlInput]);
    setUrlInput("");
    toast.success("Image URL added");
  };

  const removeImage = (indexToRemove: number) => {
    const removed = value[indexToRemove];
    if (removed) {
      deleteStorageUrls([removed]);
    }
    onChange(value.filter((_, i) => i !== indexToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Upload Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="picture">
            Upload Images
            {uploading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
          </Label>
          <div className="flex gap-2">
            <Input
              id="picture"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full max-w-sm">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="url">Or Add Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
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

      {/* Image Grid */}
      {value.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={value} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
              {value.map((url, index) => (
                <SortableImage
                  key={url}
                  id={url}
                  url={url}
                  isMain={index === 0}
                  onRemove={() => removeImage(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
          <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
          <p>No images added yet.</p>
          <p className="text-xs">Upload files or add URLs.</p>
        </div>
      )}
    </div>
  );
}
