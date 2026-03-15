"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLot } from "@/lib/actions/inventory-lot";
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

interface BinLocationOption {
  id: string;
  code: string;
  zone: string | null;
  description: string | null;
  warehouseId: string;
}

interface Props {
  warehouses: Array<{ id: string; name: string; code: string; isDefault: boolean }>;
  variants: Array<{
    id: string;
    sku: string;
    product: { content: unknown; slug: string };
  }>;
  binLocations?: BinLocationOption[];
}

export function LotForm({ warehouses, variants, binLocations = [] }: Props) {
  const t = useTranslations("admin.inventoryLots");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || ""
  );
  const [variantId, setVariantId] = useState("");
  const [binLocationId, setBinLocationId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("1");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  // Filter bin locations by selected warehouse
  const filteredBins = binLocations.filter(
    (bin) => bin.warehouseId === warehouseId
  );

  // Reset bin when warehouse changes
  function handleWarehouseChange(id: string) {
    setWarehouseId(id);
    setBinLocationId("");
  }

  function handleSubmit() {
    if (!variantId || !lotNumber || !warehouseId) {
      setError("Please fill in all required fields");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createLot({
        variantId,
        warehouseId,
        binLocationId: binLocationId || null,
        lotNumber,
        initialQuantity: parseInt(initialQuantity, 10) || 1,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        reference: reference || null,
        note: note || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/inventory-lots");
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
          <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("form.lot_number")} *</Label>
            <Input
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder={t("form.lot_number_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.warehouse")} *</Label>
            <Select value={warehouseId} onValueChange={handleWarehouseChange}>
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

          {filteredBins.length > 0 && (
            <div className="space-y-2">
              <Label>{t("form.bin_location")}</Label>
              <Select value={binLocationId} onValueChange={setBinLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.select_bin_location")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("form.no_bin")}</SelectItem>
                  {filteredBins.map((bin) => (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.code}{bin.zone ? ` (${bin.zone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>{t("form.variant")} *</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.select_variant")} />
              </SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.sku} - {resolveProductName(v.product.content)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("form.initial_quantity")} *</Label>
            <Input
              type="number"
              min={1}
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.reference")}</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("form.reference_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.manufacturing_date")}</Label>
            <Input
              type="date"
              value={manufacturingDate}
              onChange={(e) => setManufacturingDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.expiry_date")}</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{t("form.note")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("form.note_placeholder")}
              rows={2}
            />
          </div>
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
