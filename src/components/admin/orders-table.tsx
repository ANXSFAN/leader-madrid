"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { InvoiceButton } from "@/components/admin/invoice-button";
import { bulkUpdateOrderStatus } from "@/lib/actions/order";
import { toast } from "sonner";
import { OrderStatus } from "@prisma/client";
import { formatMoney } from "@/lib/formatters";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { enUS, es, zhCN, fr, de, it, pt, nl, pl } from "date-fns/locale";
import { BulkShippingDialog } from "@/components/admin/bulk-shipping-dialog";

const STATUS_KEYS: { value: OrderStatus; key: string }[] = [
  { value: "PENDING", key: "PENDING" },
  { value: "CONFIRMED", key: "CONFIRMED" },
  { value: "PROCESSING", key: "PROCESSING" },
  { value: "SHIPPED", key: "SHIPPED" },
  { value: "DELIVERED", key: "DELIVERED" },
  { value: "CANCELLED", key: "CANCELLED" },
];

const STATUS_VARIANT: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-orange-100 text-orange-800",
  DRAFT: "bg-gray-100 text-gray-600",
};

const PAYMENT_VARIANT: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800",
};

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number | { toNumber: () => number };
  createdAt: Date;
  user: { name: string | null; email: string | null } | null;
  items: { id: string; quantity: number; variant: { sku: string } }[];
}

const DATE_LOCALES: Record<string, any> = {
  en: enUS, es, zh: zhCN, fr, de, it, pt, nl, pl,
};

interface OrdersTableProps {
  orders: Order[];
  currency: string;
}

export function OrdersTable({ orders, currency }: OrdersTableProps) {
  const t = useTranslations("admin.orders");
  const tStatus = useTranslations("orders.status");
  const locale = useLocale();
  const dateLocale = DATE_LOCALES[locale] || enUS;
  const dateFormatter = (date: Date) => format(date, "PP p", { locale: dateLocale });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("CONFIRMED");
  const [isPending, startTransition] = useTransition();
  const [bulkShipOpen, setBulkShipOpen] = useState(false);

  const allIds = orders.map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkUpdate = () => {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus(ids, bulkStatus);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const label = tStatus(bulkStatus);
        toast.success(t("bulk.updated_count", { count: result.count, status: label }));
        clearSelection();
      }
    });
  };

  return (
    <div className="space-y-2">
      {/* Bulk toolbar */}
      {selectedIds.size > 0 ? (
        <div className="sticky top-0 z-20 shadow-lg flex items-center gap-3 px-4 py-2 bg-slate-900 text-white rounded-lg">
          <Badge variant="secondary" className="text-xs">
            {selectedIds.size}
          </Badge>
          <span className="text-sm font-medium">{t("bulk.selected", { count: selectedIds.size })}</span>
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={bulkStatus}
              onValueChange={(v) => setBulkStatus(v as OrderStatus)}
            >
              <SelectTrigger className="h-7 w-36 text-xs bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_KEYS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {tStatus(s.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={handleBulkUpdate}
              disabled={isPending}
            >
              {t("bulk.update_status")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1"
              onClick={() => setBulkShipOpen(true)}
            >
              <Truck className="h-3 w-3" />
              {t("bulk.create_shipments")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          {t("bulk.hint")}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
                aria-label={t("bulk.select_all")}
              />
            </TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.id")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.customer")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.date")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.status")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.payment")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.total")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.items")}</TableHead>
            <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {t("table.no_orders")}
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const total = typeof order.total === "number" ? order.total : order.total.toNumber();
              return (
                <TableRow key={order.id} className={isSelected ? "bg-blue-50/60" : "hover:bg-yellow-50/40 transition-colors"}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(order.id)}
                      aria-label={t("bulk.select_item", { name: order.orderNumber })}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.user?.name}</span>
                      <span className="text-xs text-muted-foreground">{order.user?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{dateFormatter(new Date(order.createdAt))}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANT[order.status] || "bg-gray-100 text-gray-600"}`}
                    >
                      {tStatus(order.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_VARIANT[order.paymentStatus] || "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`paymentStatus.${order.paymentStatus}`)}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">
                    {formatMoney(total, { locale, currency })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {order.items.map((item) => (
                      <div key={item.id}>
                        {item.quantity}x {item.variant.sku}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/orders/${order.id}`}>{t("table.view")}</Link>
                      </Button>
                      <InvoiceButton orderId={order.id} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BulkShippingDialog
        open={bulkShipOpen}
        onOpenChange={setBulkShipOpen}
        orderIds={Array.from(selectedIds)}
        onSuccess={clearSelection}
      />
    </div>
  );
}
