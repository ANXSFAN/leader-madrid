"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { toggleProductStatus } from "@/lib/actions/product";

interface ProductStatusSwitchProps {
  productId: string;
  initialStatus: boolean;
}

export function ProductStatusSwitch({ productId, initialStatus }: ProductStatusSwitchProps) {
  const [isActive, setIsActive] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsActive(checked); // Optimistic update
    setIsLoading(true);
    
    try {
      await toggleProductStatus(productId, checked);
      toast.success(checked ? "Product activated" : "Product deactivated");
    } catch (error) {
      setIsActive(!checked); // Revert on error
      toast.error("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={isLoading}
      className="data-[state=checked]:bg-green-600"
    />
  );
}
