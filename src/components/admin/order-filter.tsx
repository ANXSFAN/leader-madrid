"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;

export function OrderFilter() {
  const router = useRouter();
  const t = useTranslations("admin.orders");
  const tStatus = useTranslations("orders.status");
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") || "";
  const currentPaymentStatus = searchParams.get("paymentStatus") || "";

  const [status, setStatus] = useState(currentStatus);
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
  const [open, setOpen] = useState(false);

  const activeCount = [currentStatus, currentPaymentStatus].filter(
    (v) => v && v !== "all"
  ).length;

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (status && status !== "all") {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    if (paymentStatus && paymentStatus !== "all") {
      params.set("paymentStatus", paymentStatus);
    } else {
      params.delete("paymentStatus");
    }

    params.set("page", "1");
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  const clearFilters = () => {
    setStatus("");
    setPaymentStatus("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("paymentStatus");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          {t("actions.filter")}
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 min-w-[20px] px-1.5 text-[10px]"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-4">
          {/* Order Status filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("filter.order_status")}
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filter.all_statuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.all_statuses")}</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("filter.payment_status")}
            </label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filter.all_payment_statuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("filter.all_payment_statuses")}
                </SelectItem>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`paymentStatus.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={applyFilters} size="sm" className="flex-1">
              {t("actions.filter")}
            </Button>
            {activeCount > 0 && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                <X className="h-3 w-3" />
                {t("filter.clear")}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
