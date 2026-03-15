"use client";

import { useState } from "react";
import { updateRFQStatus, convertRFQToDraftOrder } from "@/lib/actions/rfq";
import { RFQStatus } from "@prisma/client";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  rfqId: string;
  currentStatus: RFQStatus;
  currentNote?: string | null;
  currentTotal?: number;
}

export default function RFQStatusForm({ rfqId, currentStatus, currentNote, currentTotal }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.adminRfq");
  const [status, setStatus] = useState<RFQStatus>(currentStatus);
  const [note, setNote] = useState(currentNote || "");
  const [total, setTotal] = useState(currentTotal?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await updateRFQStatus(rfqId, status, {
        adminNote: note || undefined,
        quotedTotal: total ? parseFloat(total) : undefined,
      });
      toast.success(t("detail.update_success"));
    } catch {
      toast.error(t("detail.update_error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToOrder() {
    if (!confirm(t("detail.convert_confirm"))) return;

    setConverting(true);
    try {
      const res = await convertRFQToDraftOrder(rfqId);
      if (res.error) {
        toast.error(res.error);
      } else if (res.success && res.orderId) {
        toast.success(t("detail.convert_success"));
        router.push(`/admin/orders/${res.orderId}`);
      }
    } catch (e) {
      toast.error(t("detail.convert_error"));
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as RFQStatus)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {(["PENDING", "REVIEWING", "QUOTED", "ACCEPTED", "REJECTED", "EXPIRED"] as RFQStatus[]).map((s) => (
          <option key={s} value={s}>{t(`status.${s}`)}</option>
        ))}
      </select>
      <input
        type="number"
        placeholder={t("detail.quoted_total_placeholder")}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={handleSave}
        disabled={loading || converting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {t("detail.save")}
      </button>

      {status === "QUOTED" && (
        <button
          onClick={handleConvertToOrder}
          disabled={converting || loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          title={t("detail.convert_to_order")}
        >
          {converting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ShoppingCart size={14} />
          )}
          {t("detail.convert_to_order")}
        </button>
      )}
    </div>
  );
}
