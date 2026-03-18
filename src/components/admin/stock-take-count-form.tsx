"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateStockTakeCount } from "@/lib/actions/stock-take";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";

interface StockTakeItemData {
  variantId: string;
  sku: string;
  productName: string;
  systemQty: number;
  countedQty: number | null;
  note: string | null;
}

interface Props {
  stockTakeId: string;
  items: StockTakeItemData[];
}

interface CountEntry {
  countedQty: string;
  note: string;
}

export function StockTakeCountForm({ stockTakeId, items }: Props) {
  const t = useTranslations("admin.stockTakes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [counts, setCounts] = useState<Record<string, CountEntry>>(() => {
    const initial: Record<string, CountEntry> = {};
    for (const item of items) {
      initial[item.variantId] = {
        countedQty: item.countedQty !== null ? String(item.countedQty) : "",
        note: item.note || "",
      };
    }
    return initial;
  });

  function updateCount(variantId: string, field: keyof CountEntry, value: string) {
    setCounts((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], [field]: value },
    }));
  }

  function getDiscrepancy(variantId: string, systemQty: number): number | null {
    const entry = counts[variantId];
    if (!entry || entry.countedQty === "") return null;
    const counted = parseInt(entry.countedQty, 10);
    if (isNaN(counted)) return null;
    return counted - systemQty;
  }

  function handleSave() {
    setError(null);
    setSuccess(false);

    // Collect items that have been counted
    const countedItems = items
      .filter((item) => {
        const entry = counts[item.variantId];
        return entry && entry.countedQty !== "" && !isNaN(parseInt(entry.countedQty, 10));
      })
      .map((item) => ({
        variantId: item.variantId,
        countedQty: parseInt(counts[item.variantId].countedQty, 10),
        note: counts[item.variantId].note || undefined,
      }));

    if (countedItems.length === 0) {
      setError("Please enter at least one count");
      return;
    }

    startTransition(async () => {
      const result = await updateStockTakeCount(stockTakeId, countedItems);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 text-green-700 p-3 text-sm">
          {t("count.saved_successfully")}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.sku")}</TableHead>
              <TableHead>{t("detail.product")}</TableHead>
              <TableHead className="text-right">{t("detail.system_qty")}</TableHead>
              <TableHead className="w-[120px]">{t("detail.counted_qty")}</TableHead>
              <TableHead className="text-right">{t("detail.discrepancy")}</TableHead>
              <TableHead className="w-[200px]">{t("detail.note")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const disc = getDiscrepancy(item.variantId, item.systemQty);
              return (
                <TableRow key={item.variantId}>
                  <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-right">{item.systemQty}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={counts[item.variantId]?.countedQty || ""}
                      onChange={(e) => updateCount(item.variantId, "countedQty", e.target.value)}
                      className="w-[100px]"
                    />
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    disc !== null && disc === 0 && "text-green-600",
                    disc !== null && disc < 0 && "text-red-600",
                    disc !== null && disc > 0 && "text-yellow-600",
                  )}>
                    {disc !== null ? (disc >= 0 ? `+${disc}` : disc) : "-"}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={counts[item.variantId]?.note || ""}
                      onChange={(e) => updateCount(item.variantId, "note", e.target.value)}
                      placeholder={t("count.note_placeholder")}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("count.save")}
        </Button>
      </div>
    </div>
  );
}
