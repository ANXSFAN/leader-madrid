"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { completeStockTransfer, cancelStockTransfer } from "@/lib/actions/warehouse";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";

interface StockTransferActionsProps {
  transfer: {
    id: string;
    status: string;
  };
}

export function StockTransferActions({ transfer }: StockTransferActionsProps) {
  const t = useTranslations("admin.stock_transfers");
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const canComplete = transfer.status === "PENDING" || transfer.status === "IN_TRANSIT";
  const canCancel = transfer.status === "PENDING" || transfer.status === "IN_TRANSIT";

  async function handleComplete() {
    if (!confirm(t("confirm_complete"))) return;
    setLoading("complete");
    const result = await completeStockTransfer(transfer.id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  async function handleCancel() {
    if (!confirm(t("confirm_cancel"))) return;
    setLoading("cancel");
    const result = await cancelStockTransfer(transfer.id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  if (!canComplete && !canCancel) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {canComplete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleComplete}
          disabled={loading !== null}
          title={t("actions.complete")}
        >
          {loading === "complete" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      )}
      {canCancel && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleCancel}
          disabled={loading !== null}
          title={t("actions.cancel")}
        >
          {loading === "cancel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
