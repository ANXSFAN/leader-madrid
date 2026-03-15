"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductThumbnailProps {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function ProductThumbnail({
  src,
  alt,
  className,
  width = 40,
  height = 40,
}: ProductThumbnailProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={cn(
          "bg-slate-100 flex items-center justify-center text-slate-400",
          className
        )}
        style={{ width, height }}
      >
        <ImageOff className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  );
}
