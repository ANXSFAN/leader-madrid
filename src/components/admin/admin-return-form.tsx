"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { adminCreateReturn } from "@/lib/actions/returns";

interface OrderItem {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
}

interface FoundOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
}

interface SelectedItem {
  orderItemId: string;
  variantId: string;
  name: string;
  sku: string;
  maxQty: number;
  returnQty: number;
  condition: "RESELLABLE" | "DAMAGED";
}

interface AdminReturnFormProps {
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}

export function AdminReturnForm({ warehouses }: AdminReturnFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.returns.adminCreate");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [foundOrder, setFoundOrder] = useState<FoundOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || ""
  );
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");

  const searchOrder = async () => {
    if (!orderQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin-return-search?q=${encodeURIComponent(orderQuery.trim())}`
      );
      if (!res.ok) {
        toast.error(t("order_not_found"));
        setFoundOrder(null);
        setSelectedItems([]);
        setSearching(false);
        return;
      }
      const data = await res.json();
      setFoundOrder(data);
      setSelectedItems([]);
    } catch {
      toast.error(t("search_error"));
    }
    setSearching(false);
  };

  const toggleItem = (item: OrderItem, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [
        ...prev,
        {
          orderItemId: item.id,
          variantId: item.variantId,
          name: item.name,
          sku: item.sku,
          maxQty: item.quantity,
          returnQty: item.quantity,
          condition: "RESELLABLE",
        },
      ]);
    } else {
      setSelectedItems((prev) =>
        prev.filter((si) => si.orderItemId !== item.id)
      );
    }
  };

  const updateItemQty = (orderItemId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((si) =>
        si.orderItemId === orderItemId
          ? { ...si, returnQty: Math.min(qty, si.maxQty) }
          : si
      )
    );
  };

  const updateItemCondition = (
    orderItemId: string,
    condition: "RESELLABLE" | "DAMAGED"
  ) => {
    setSelectedItems((prev) =>
      prev.map((si) =>
        si.orderItemId === orderItemId ? { ...si, condition } : si
      )
    );
  };

  const onSubmit = async () => {
    if (!foundOrder) return;
    if (selectedItems.length === 0) {
      toast.error(t("no_items_selected"));
      return;
    }
    if (!warehouseId) {
      toast.error(t("warehouse_required"));
      return;
    }
    if (!reason) {
      toast.error(t("reason_required"));
      return;
    }

    setLoading(true);
    const result = await adminCreateReturn({
      orderId: foundOrder.id,
      warehouseId,
      reason,
      notes,
      items: selectedItems.map((si) => ({
        orderItemId: si.orderItemId,
        variantId: si.variantId,
        quantity: si.returnQty,
        condition: si.condition,
      })),
    });

    if (result.success) {
      toast.success(t("success"));
      router.push("/admin/returns");
    } else {
      toast.error(result.error || t("error"));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("search_order")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("search_placeholder")}
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOrder()}
            />
            <Button onClick={searchOrder} disabled={searching} variant="outline">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {foundOrder && (
            <div className="mt-4 p-3 rounded-md bg-slate-50 text-sm">
              <span className="font-medium">{t("order")}:</span>{" "}
              <span className="font-mono">{foundOrder.orderNumber}</span>
              <span className="mx-2">|</span>
              <span className="font-medium">{t("customer")}:</span>{" "}
              {foundOrder.customerName}
            </div>
          )}
        </CardContent>
      </Card>

      {foundOrder && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="border-l-4 border-yellow-500 pl-3">
                {t("select_items")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("sku_col")}</TableHead>
                      <TableHead>{t("ordered_qty")}</TableHead>
                      <TableHead>{t("return_qty")}</TableHead>
                      <TableHead>{t("condition")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foundOrder.items.map((item) => {
                      const selected = selectedItems.find(
                        (si) => si.orderItemId === item.id
                      );
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={!!selected}
                              onCheckedChange={(checked) =>
                                toggleItem(item, !!checked)
                              }
                            />
                          </TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.sku}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            {selected && (
                              <Input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={selected.returnQty}
                                onChange={(e) =>
                                  updateItemQty(
                                    item.id,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-20"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {selected && (
                              <Select
                                value={selected.condition}
                                onValueChange={(v) =>
                                  updateItemCondition(
                                    item.id,
                                    v as "RESELLABLE" | "DAMAGED"
                                  )
                                }
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="RESELLABLE">
                                    {t("condition_resellable")}
                                  </SelectItem>
                                  <SelectItem value="DAMAGED">
                                    {t("condition_damaged")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="border-l-4 border-yellow-500 pl-3">
                {t("return_details")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("warehouse")}</label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_warehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("reason_label")}</label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_reason")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEFECTIVE">{t("reason_defective")}</SelectItem>
                    <SelectItem value="WRONG_ITEM">{t("reason_wrong_item")}</SelectItem>
                    <SelectItem value="DAMAGED_IN_TRANSIT">{t("reason_damaged_transit")}</SelectItem>
                    <SelectItem value="CHANGED_MIND">{t("reason_changed_mind")}</SelectItem>
                    <SelectItem value="OTHER">{t("reason_other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">{t("notes")}</label>
                <Textarea
                  placeholder={t("notes_placeholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {selectedItems.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Badge variant="secondary">
                      {selectedItems.length} {t("items_selected")}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">
                      {t("total_return_qty")}:{" "}
                      {selectedItems.reduce((s, i) => s + i.returnQty, 0)}
                    </span>
                  </div>
                  <Button
                    onClick={onSubmit}
                    disabled={loading}
                    className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("submit")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
