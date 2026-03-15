"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerLowStockAlert } from "@/lib/actions/inventory";
import { toast } from "sonner";

export function SendStockAlertButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await triggerLowStockAlert();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`已发送 ${result.sent} 个低库存告警邮件`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <AlertTriangle className="h-3 w-3 mr-1" />
      )}
      发送库存预警邮件
    </Button>
  );
}
