"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStockTake } from "@/lib/actions/stock-take";
import { Loader2 } from "lucide-react";

interface Props {
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
}

export function StockTakeNewForm({ warehouses }: Props) {
  const t = useTranslations("admin.stockTakes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [note, setNote] = useState("");

  function handleSubmit() {
    if (!warehouseId) {
      setError("Please select a warehouse");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createStockTake({
        warehouseId,
        note: note || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.stockTake) {
        router.push(`/admin/stock-takes/${result.stockTake.id}`);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="border-l-4 border-yellow-500 pl-3">
          {t("form.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label>{t("form.warehouse")}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
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
          <Label>{t("form.note")}</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("form.note_placeholder")}
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("form.create")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
