"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  approveReturn, rejectReturn, markReturnReceived, processRefund, closeReturn,
} from "@/lib/actions/returns";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReturnItem { id: string; quantity: number; restockQty: number }

export function ReturnActions({
  returnId,
  status,
  items,
  orderTotal,
  warehouses,
}: {
  returnId: string;
  status: string;
  items: ReturnItem[];
  orderTotal: number;
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}) {
  const t = useTranslations("admin.returns");
  const [loading, setLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [restockData, setRestockData] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.quantity]))
  );
  const [refundAmount, setRefundAmount] = useState(orderTotal);
  const defaultWarehouse = warehouses.find((w) => w.isDefault);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id || "");

  async function handle(fn: () => Promise<any>) {
    setLoading(true);
    try {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else toast.success(t("actions.updated_ok"));
    } catch {
      toast.error(t("actions.action_error"));
    } finally {
      setLoading(false);
    }
  }

  if (status === "REQUESTED") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("actions.internal_notes")}</Label>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder={t("actions.notes_placeholder")}
            rows={2}
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => handle(() => approveReturn(returnId, adminNotes))}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.approve")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => handle(() => rejectReturn(returnId, adminNotes))}
            disabled={loading}
          >
            {t("actions.reject")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("actions.when_received_desc")}
        </p>

        <div className="space-y-2">
          <Label>{t("actions.warehouse_label")}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={t("actions.select_warehouse")} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Label className="w-32 text-xs">{t("actions.item_label", { id: item.id.slice(0, 8) })}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("actions.requested_qty", { qty: item.quantity })}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={item.quantity}
                  className="w-20 h-8 text-sm"
                  value={restockData[item.id] ?? 0}
                  onChange={(e) =>
                    setRestockData((prev) => ({
                      ...prev,
                      [item.id]: Number(e.target.value),
                    }))
                  }
                />
                <span className="text-xs">{t("actions.restock_label")}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label>{t("actions.internal_notes")}</Label>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder={t("actions.received_notes_placeholder")}
            rows={2}
          />
        </div>
        <Button
          onClick={() =>
            handle(() =>
              markReturnReceived(
                returnId,
                Object.entries(restockData).map(([itemId, qty]) => ({
                  itemId,
                  restockQty: qty,
                })),
                adminNotes,
                warehouseId
              )
            )
          }
          disabled={loading || !warehouseId}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.mark_received")}
        </Button>
      </div>
    );
  }

  if (status === "RECEIVED") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("actions.refund_amount_label")}</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={orderTotal}
            value={refundAmount}
            onChange={(e) => setRefundAmount(Number(e.target.value))}
            className="w-40"
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => handle(() => processRefund(returnId, refundAmount))}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.process_refund")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "REFUNDED") {
    return (
      <Button
        variant="outline"
        onClick={() => handle(() => closeReturn(returnId))}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.close_request")}
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {t("actions.no_actions")}
    </p>
  );
}
