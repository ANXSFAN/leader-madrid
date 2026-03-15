"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createReturnRequest, getOrderForReturn } from "@/lib/actions/returns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RotateCcw, Package, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { formatMoney } from "@/lib/formatters";
import { labelCode } from "@/lib/i18n-labels";

const REASON_CODES = [
  "DEFECTIVE",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "DAMAGED_IN_TRANSIT",
  "CHANGED_MIND",
  "OTHER",
] as const;

const CONDITION_CODES = ["NEW", "USED", "DAMAGED"] as const;

interface OrderItem {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export default function ReturnRequestPage(
  props: {
    params: Promise<{ id: string; locale: string }>;
  }
) {
  const params = use(props.params);
  const locale = useLocale();
  const t = useTranslations("returns.request");
  const tReturns = useTranslations("returns");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<{
    id: string;
    orderNumber: string;
    items: OrderItem[];
    currency: string;
  } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [condition, setCondition] = useState<string>("NEW");

  useEffect(() => {
    let cancelled = false;
    async function fetchOrder() {
      const data = await getOrderForReturn(params.id);
      if (cancelled || !data) return;

      setOrderData(data);

      const initialSelected: Record<string, number> = {};
      data.items.forEach((item) => {
        initialSelected[item.id] = item.quantity;
      });
      setSelectedItems(initialSelected);
    }
    fetchOrder();
    return () => { cancelled = true; };
  }, [params.id]);

  const fm = (amount: number) =>
    formatMoney(amount, { locale, currency: orderData?.currency ?? "EUR" });

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSelected = { ...prev };
      if (newSelected[itemId]) {
        delete newSelected[itemId];
      } else {
        const item = orderData?.items.find((i) => i.id === itemId);
        if (item) newSelected[itemId] = item.quantity;
      }
      return newSelected;
    });
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError(t("error_no_reason"));
      return;
    }

    const selectedItemIds = Object.keys(selectedItems).filter(
      (id) => selectedItems[id] > 0
    );

    if (selectedItemIds.length === 0) {
      setError(t("error_no_items"));
      return;
    }

    setLoading(true);

    try {
      const items = selectedItemIds.map((itemId) => {
        const item = orderData?.items.find((i) => i.id === itemId);
        return {
          variantId: item?.variantId || "",
          orderItemId: itemId,
          quantity: selectedItems[itemId],
          condition: condition as "NEW" | "USED" | "DAMAGED",
        };
      });

      const result = await createReturnRequest({
        orderId: params.id,
        reason: reason as typeof REASON_CODES[number],
        notes: notes || undefined,
        items,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("error_processing"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              {t("success_title")}
            </h2>
            <p className="text-green-700 mb-6">{t("success_desc")}</p>
            <div className="flex gap-4 justify-center">
              <Button asChild>
                <Link href="/profile">{t("view_my_orders")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/profile">{t("back_to_orders")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link
          href={`/profile/orders/${params.id}`}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back_to_order")}
        </Link>
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 rounded-lg">
          <RotateCcw className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("order_label", { number: orderData.orderNumber })}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("items_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderData.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Checkbox
                  id={item.id}
                  checked={!!selectedItems[item.id]}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <div className="relative h-16 w-16 rounded-md overflow-hidden border bg-white shrink-0">
                  <Image
                    src={item.imageUrl || "/placeholder-image.jpg"}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={item.id}
                    className="font-medium cursor-pointer block truncate"
                  >
                    {item.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    SKU: {item.sku} • {fm(item.price)}
                  </p>
                </div>
                {selectedItems[item.id] !== undefined && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{t("qty")}</Label>
                    <Select
                      value={String(selectedItems[item.id])}
                      onValueChange={(v) => updateQuantity(item.id, parseInt(v))}
                    >
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: item.quantity }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("reason_section")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reason">{t("reason_label")}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("reason_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REASON_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {labelCode(tReturns as (key: string) => string, "reason", code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="condition">{t("condition_label")}</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {labelCode(tReturns as (key: string) => string, "condition", code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">{t("notes_label")}</Label>
              <Textarea
                id="notes"
                placeholder={t("notes_placeholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? t("submitting") : t("submit")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/profile/orders/${params.id}`}>{t("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
