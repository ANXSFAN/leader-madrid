"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { createStockTransfer, searchVariantsForTransfer } from "@/lib/actions/warehouse";
import { getLocalized } from "@/lib/content";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Save, Plus, Trash2, Loader2, Search } from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

interface TransferItem {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  availableStock?: number;
}

interface StockTransferFormProps {
  warehouses: Warehouse[];
}

export function StockTransferForm({ warehouses }: StockTransferFormProps) {
  const t = useTranslations("admin.stock_transfers");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);

  // Variant search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (!searchQuery.trim() || !fromWarehouseId) return;
    setSearching(true);
    try {
      const results = await searchVariantsForTransfer(searchQuery, fromWarehouseId);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function addItem(variant: any) {
    if (items.some((i) => i.variantId === variant.id)) return;

    const productName = getLocalized(variant.productContent, locale).name;
    setItems([...items, {
      variantId: variant.id,
      sku: variant.sku,
      productName,
      quantity: 1,
      availableStock: variant.warehouseStock ?? variant.globalStock,
    }]);
    setSearchResults([]);
    setSearchQuery("");
  }

  function removeItem(variantId: string) {
    setItems(items.filter((i) => i.variantId !== variantId));
  }

  function updateQuantity(variantId: string, quantity: number) {
    setItems(items.map((i) =>
      i.variantId === variantId ? { ...i, quantity: Math.max(1, quantity) } : i
    ));
  }

  async function onSubmit() {
    if (!fromWarehouseId || !toWarehouseId) {
      setError(t("error_select_warehouses"));
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError(t("error_same_warehouse"));
      return;
    }
    if (items.length === 0) {
      setError(t("error_no_items"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createStockTransfer({
        fromWarehouseId,
        toWarehouseId,
        note: note || undefined,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/stock-transfers");
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Warehouse selection */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("form.warehouses")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t("form.from_warehouse")} *</Label>
              <Select value={fromWarehouseId} onValueChange={(val) => {
                setFromWarehouseId(val);
                setItems([]); // Reset items when changing source
                setSearchResults([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.select_warehouse")} />
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

            <div className="space-y-2">
              <Label>{t("form.to_warehouse")} *</Label>
              <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.select_warehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((wh) => wh.id !== fromWarehouseId)
                    .map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>{t("form.note")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("form.note_placeholder")}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("form.items")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar */}
          {fromWarehouseId && (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("form.search_placeholder")}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-60 overflow-auto">
              {searchResults.map((v) => {
                const productName = getLocalized(v.productContent, locale).name;
                const stock = v.warehouseStock ?? v.globalStock;
                const alreadyAdded = items.some((i) => i.variantId === v.id);
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between px-4 py-2 text-sm ${
                      alreadyAdded ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50 cursor-pointer"
                    }`}
                    onClick={() => !alreadyAdded && addItem(v)}
                  >
                    <div>
                      <span className="font-medium">{productName}</span>
                      <span className="text-muted-foreground ml-2">({v.sku})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("form.stock_label")}: {stock}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Items table */}
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t("form.product")}</TableHead>
                  <TableHead>{t("form.sku")}</TableHead>
                  <TableHead>{t("form.available")}</TableHead>
                  <TableHead className="w-[150px]">{t("form.quantity")}</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.variantId}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{item.sku}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.availableStock ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={item.availableStock || undefined}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.variantId, parseInt(e.target.value) || 1)}
                        className="w-24 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => removeItem(item.variantId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {fromWarehouseId ? t("form.no_items") : t("form.select_source_first")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={loading || items.length === 0}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("form.create")}
        </Button>
      </div>
    </div>
  );
}
