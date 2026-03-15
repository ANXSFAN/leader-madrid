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
  startStockTake,
  completeStockTake,
  cancelStockTake,
} from "@/lib/actions/stock-take";
import { Loader2, Play, CheckCircle, XCircle } from "lucide-react";

interface Props {
  stockTakeId: string;
  status: string;
}

export function StockTakeActions({ stockTakeId, status }: Props) {
  const t = useTranslations("admin.stockTakes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: "start" | "complete" | "cancel") {
    setError(null);
    startTransition(async () => {
      let result;
      switch (action) {
        case "start":
          result = await startStockTake(stockTakeId);
          break;
        case "complete":
          result = await completeStockTake(stockTakeId);
          break;
        case "cancel":
          result = await cancelStockTake(stockTakeId);
          break;
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
          onClick={() => handleAction("start")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
          {t("actions.start")}
        </Button>
      )}

      {status === "IN_PROGRESS" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
              {t("actions.complete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("dialog.complete_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dialog.complete_description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAction("complete")}>
                {t("dialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {(status === "DRAFT" || status === "IN_PROGRESS") && (
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
              <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
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
