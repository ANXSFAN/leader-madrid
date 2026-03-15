"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { bulkCreateShipments } from "@/lib/actions/order";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type CarrierMethod = {
  id: number;
  name: string;
  carrier: string;
  min_weight: string;
  max_weight: string;
  price: number;
};

interface BulkShippingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderIds: string[];
  onSuccess: () => void;
}

export function BulkShippingDialog({
  open,
  onOpenChange,
  orderIds,
  onSuccess,
}: BulkShippingDialogProps) {
  const t = useTranslations("admin.orders.bulk");
  const router = useRouter();
  const [carrierMethods, setCarrierMethods] = useState<CarrierMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [weight, setWeight] = useState("1.000");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/logistics/shipping-methods");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data.data)) {
          setCarrierMethods(data.data);
        }
      } catch {}
    };
    load();
    return () => { mounted = false; };
  }, [open]);

  const handleSubmit = () => {
    if (!selectedMethodId) {
      toast.error(t("shipping_dialog_select_method"));
      return;
    }
    if (orderIds.length === 0) {
      toast.error(t("shipping_dialog_no_orders"));
      return;
    }

    startTransition(async () => {
      const result = await bulkCreateShipments(
        orderIds,
        Number(selectedMethodId),
        weight
      );

      if ("error" in result && result.error) {
        toast.error(result.error);
      } else if (result.success) {
        const msg = t("shipping_dialog_result", {
          success: result.successCount,
          fail: result.failCount,
        });
        if (result.failCount && result.failCount > 0) {
          toast.warning(msg);
        } else {
          toast.success(msg);
        }
        onOpenChange(false);
        onSuccess();
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t("shipping_dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {t("shipping_dialog_desc", { count: orderIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("shipping_dialog_carrier")}</Label>
            <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
              <SelectTrigger>
                <SelectValue placeholder={t("shipping_dialog_select_method")} />
              </SelectTrigger>
              <SelectContent>
                {carrierMethods.map((method) => (
                  <SelectItem key={method.id} value={String(method.id)}>
                    {method.name} · {method.carrier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("shipping_dialog_weight")}</Label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("shipping_dialog_cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("shipping_dialog_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
