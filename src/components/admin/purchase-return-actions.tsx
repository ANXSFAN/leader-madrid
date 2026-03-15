"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  confirmPurchaseReturn,
  shipPurchaseReturn,
  completePurchaseReturn,
  refundPurchaseReturn,
  cancelPurchaseReturn,
} from "@/lib/actions/purchase-return";
import { Loader2, CheckCircle, Truck, Package, DollarSign, XCircle } from "lucide-react";

interface Props {
  purchaseReturnId: string;
  status: string;
}

export function PurchaseReturnActions({ purchaseReturnId, status }: Props) {
  const t = useTranslations("admin.purchaseReturns");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: string) {
    setError(null);
    startTransition(async () => {
      let result;
      switch (action) {
        case "confirm":
          result = await confirmPurchaseReturn(purchaseReturnId);
          break;
        case "ship":
          result = await shipPurchaseReturn(purchaseReturnId);
          break;
        case "complete":
          result = await completePurchaseReturn(purchaseReturnId);
          break;
        case "refund":
          result = await refundPurchaseReturn(purchaseReturnId);
          break;
        case "cancel":
          result = await cancelPurchaseReturn(purchaseReturnId);
          break;
        default:
          return;
      }
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}

      {status === "DRAFT" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("confirm")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
          {t("actions.confirm")}
        </Button>
      )}

      {status === "CONFIRMED" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("ship")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Truck className="mr-1 h-4 w-4" />}
          {t("actions.ship")}
        </Button>
      )}

      {status === "SHIPPED_TO_SUPPLIER" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("complete")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Package className="mr-1 h-4 w-4" />}
          {t("actions.complete")}
        </Button>
      )}

      {status === "RECEIVED_BY_SUPPLIER" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("refund")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <DollarSign className="mr-1 h-4 w-4" />}
          {t("actions.refund")}
        </Button>
      )}

      {(status === "DRAFT" || status === "CONFIRMED") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              <XCircle className="mr-1 h-4 w-4" />
              {t("actions.cancel")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialog.cancel_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialog.cancel_description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("dialog.keep")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction("cancel")}
                className="bg-red-600 hover:bg-red-700"
              >
                {t("dialog.confirm_cancel")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
