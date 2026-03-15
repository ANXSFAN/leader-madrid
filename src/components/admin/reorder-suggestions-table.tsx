"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/formatters";
import { convertSuggestionsToPO } from "@/lib/actions/reorder-suggestions";
import type { ReorderSuggestion } from "@/lib/actions/reorder-suggestions";
import { Loader2, ShoppingCart } from "lucide-react";

interface Props {
  suggestions: ReorderSuggestion[];
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
  locale: string;
  currency: string;
}

export function ReorderSuggestionsTable({ suggestions, warehouses, locale, currency }: Props) {
  const t = useTranslations("admin.reorderSuggestions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );

  function toggleAll() {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((s) => s.variantId)));
    }
  }

  function toggleOne(variantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  function handleCreatePO() {
    if (selected.size === 0) return;

    // Group selected by supplier - for now, use the first supplier
    const selectedSuggestions = suggestions.filter((s) => selected.has(s.variantId));
    const supplierIds = new Set(
      selectedSuggestions
        .filter((s) => s.primarySupplier)
        .map((s) => s.primarySupplier!.id)
    );

    if (supplierIds.size === 0) {
      setError("Selected items have no primary supplier assigned");
      return;
    }

    if (supplierIds.size > 1) {
      setError("Selected items belong to multiple suppliers. Please select items from the same supplier.");
      return;
    }

    setShowDialog(true);
  }

  function confirmCreatePO() {
    const selectedSuggestions = suggestions.filter((s) => selected.has(s.variantId));
    const supplierId = selectedSuggestions[0]?.primarySupplier?.id;
    if (!supplierId) return;

    setError(null);
    startTransition(async () => {
      const result = await convertSuggestionsToPO({
        supplierId,
        warehouseId,
        items: selectedSuggestions.map((s) => ({
          variantId: s.variantId,
          quantity: s.suggestedQty,
          costPrice: s.lastPurchasePrice || s.costPrice || 0,
        })),
      });

      if (result.error) {
        setError(result.error);
        setShowDialog(false);
      } else if (result.poId) {
        router.push(`/admin/purchase-orders/${result.poId}`);
      } else {
        router.push("/admin/purchase-orders");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {t("selected_count", { count: selected.size })}
          </span>
          <Button
            onClick={handleCreatePO}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t("create_po")}
          </Button>
        </div>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selected.size === suggestions.length && suggestions.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>{t("table.sku")}</TableHead>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead className="text-right">{t("table.current_stock")}</TableHead>
              <TableHead className="text-right">{t("table.reorder_point")}</TableHead>
              <TableHead className="text-right">{t("table.suggested_qty")}</TableHead>
              <TableHead className="text-right">{t("table.last_price")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map((s) => (
              <TableRow key={s.variantId}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(s.variantId)}
                    onCheckedChange={() => toggleOne(s.variantId)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                <TableCell>{s.productName}</TableCell>
                <TableCell className="text-right">
                  <span className={s.availableStock <= 0 ? "text-red-600 font-medium" : ""}>
                    {s.availableStock}
                  </span>
                </TableCell>
                <TableCell className="text-right">{s.reorderPoint}</TableCell>
                <TableCell className="text-right font-medium">{s.suggestedQty}</TableCell>
                <TableCell className="text-right">
                  {s.lastPurchasePrice
                    ? formatMoney(s.lastPurchasePrice, { locale, currency })
                    : "-"}
                </TableCell>
                <TableCell>{s.primarySupplier?.name || "-"}</TableCell>
              </TableRow>
            ))}
            {suggestions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                  {t("table.no_suggestions")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm PO Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("dialog.warehouse")}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue />
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
            <p className="text-sm text-muted-foreground">
              {t("dialog.items_count", { count: selected.size })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              onClick={confirmCreatePO}
              disabled={isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
