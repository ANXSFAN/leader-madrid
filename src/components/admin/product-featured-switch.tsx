"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleProductFeatured } from "@/lib/actions/product";
import { cn } from "@/lib/utils";

interface ProductFeaturedSwitchProps {
  productId: string;
  initialFeatured: boolean;
}

export function ProductFeaturedSwitch({ productId, initialFeatured }: ProductFeaturedSwitchProps) {
  const [isFeatured, setIsFeatured] = useState(initialFeatured);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    const newValue = !isFeatured;
    setIsFeatured(newValue);
    setIsLoading(true);

    try {
      await toggleProductFeatured(productId, newValue);
      toast.success(newValue ? "已设为精选" : "已取消精选");
    } catch (error) {
      setIsFeatured(!newValue);
      toast.error("操作失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "p-1 rounded transition-colors",
        isFeatured
          ? "text-amber-500 hover:text-amber-600"
          : "text-slate-300 hover:text-slate-400"
      )}
      title={isFeatured ? "取消精选" : "设为精选"}
    >
      <Star className={cn("h-4 w-4", isFeatured && "fill-current")} />
    </button>
  );
}
