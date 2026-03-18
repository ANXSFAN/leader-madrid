"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createPurchaseReturn } from "@/lib/actions/purchase-return";
import { formatMoney } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

interface ProductContentJson {
  [locale: string]: { name?: string } | string | undefined;
}

function resolveProductName(content: unknown): string {
  const c = content as ProductContentJson | null;
  if (!c) return "";
  for (const locale of ["en", "es", "de", "fr", "zh"]) {
    const localeData = c[locale];
    if (typeof localeData === "object" && localeData?.name) {
      return localeData.name;
    }
  }
  return "";
}

interface POItem {
  id: string;
  variantId: string;
  quantity: number;
  receivedQty: number;
  costPrice: number;
  variant: {
    id: string;
    sku: string;
    costPrice: number | null;
    product: { content: unknown; slug: string };
  };
}

interface PurchaseOrderData {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  supplier: { id: string; name: string };
  items: POItem[];
}

interface Props {
  purchaseOrders: PurchaseOrderData[];
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
  locale: string;
  currency: string;
}

interface ReturnItemState {
  selected: boolean;
  quantity: number;
  maxQty: number;
}

export function PurchaseReturnForm({ purchaseOrders, warehouses, locale, currency }: Props) {
  const t = useTranslations("admin.purchaseReturns");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedPOId, setSelectedPOId] = useState("");
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<Record<string, ReturnItemState>>({});

  const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId);

  function handlePOChange(poId: string) {
    setSelectedPOId(poId);
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) {
      const items: Record<string, ReturnItemState> = {};
      for (const item of po.items) {
        if (item.receivedQty > 0) {
          items[item.variantId] = {
            selected: false,
            quantity: 1,
            maxQty: item.receivedQty,
          };
        }
      }
      setReturnItems(items);
    } else {
      setReturnItems({});
    }
  }

  function toggleItem(variantId: string) {
    setReturnItems((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], selected: !prev[variantId].selected },
    }));
  }

  function updateQuantity(variantId: string, qty: number) {
    setReturnItems((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], quantity: qty },
    }));
  }

  function handleSubmit() {
    if (!selectedPO) {
      setError("Please select a purchase order");
      return;
    }

    const selectedItems = Object.entries(returnItems)
      .filter(([, state]) => state.selected)
      .map(([variantId, state]) => {
        const poItem = selectedPO.items.find((i) => i.variantId === variantId);
        return {
          variantId,
          quantity: state.quantity,
          costPrice: poItem?.costPrice || 0,
        };
      });

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createPurchaseReturn({
        purchaseOrderId: selectedPO.id,
        warehouseId: selectedPO.warehouseId,
        reason: reason || undefined,
        items: selectedItems,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.purchaseReturn) {
        router.push(`/admin/purchase-returns/${result.purchaseReturn.id}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="border-l-4 border-accent pl-3">
            {t("form.select_po")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("form.purchase_order")}</Label>
            <Select value={selectedPOId} onValueChange={handlePOChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.select_po_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.poNumber} - {po.supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPO && (
            <div className="text-sm text-muted-foreground">
              <p><strong>{t("form.supplier")}:</strong> {selectedPO.supplier.name}</p>
              <p>
                <strong>{t("form.warehouse")}:</strong>{" "}
                {warehouses.find((w) => w.id === selectedPO.warehouseId)?.name || selectedPO.warehouseId}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("form.reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("form.reason_placeholder")}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {selectedPO && selectedPO.items.filter((i) => i.receivedQty > 0).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="border-l-4 border-accent pl-3">
              {t("form.select_items")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{t("detail.sku")}</TableHead>
                  <TableHead>{t("detail.product")}</TableHead>
                  <TableHead className="text-right">{t("form.received")}</TableHead>
                  <TableHead className="w-[120px]">{t("form.return_qty")}</TableHead>
                  <TableHead className="text-right">{t("detail.cost_price")}</TableHead>
                  <TableHead className="text-right">{t("detail.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPO.items
                  .filter((item) => item.receivedQty > 0)
                  .map((item) => {
                    const state = returnItems[item.variantId];
                    if (!state) return null;
                    const lineTotal = state.selected ? state.quantity * item.costPrice : 0;

                    return (
                      <TableRow key={item.variantId}>
                        <TableCell>
                          <Checkbox
                            checked={state.selected}
                            onCheckedChange={() => toggleItem(item.variantId)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.variant.sku}</TableCell>
                        <TableCell>{resolveProductName(item.variant.product.content)}</TableCell>
                        <TableCell className="text-right">{item.receivedQty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={state.maxQty}
                            value={state.quantity}
                            onChange={(e) =>
                              updateQuantity(item.variantId, Math.max(1, Math.min(state.maxQty, parseInt(e.target.value) || 1)))
                            }
                            disabled={!state.selected}
                            className="w-[100px]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(item.costPrice, { locale, currency })}
                        </TableCell>
                        <TableCell className="text-right">
                          {state.selected ? formatMoney(lineTotal, { locale, currency }) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("form.create_return")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
