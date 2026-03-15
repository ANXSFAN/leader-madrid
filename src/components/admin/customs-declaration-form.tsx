"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileDown } from "lucide-react";
import {
  createCustomsDeclaration,
  updateCustomsDeclaration,
  getPurchaseOrderForCustoms,
} from "@/lib/actions/customs";
import { CustomsItemsTable } from "./customs-items-table";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// --- Zod Schema (mirrors server-side) ---

const customsItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  hsCode: z.string().optional(),
  quantity: z.preprocess((v) => (Number.isNaN(v) ? 1 : Number(v)), z.number().int().min(1)),
  unitPrice: z.preprocess((v) => (Number.isNaN(v) ? 0 : Number(v)), z.number().min(0)),
  totalValue: z.preprocess((v) => (Number.isNaN(v) ? 0 : Number(v)), z.number().min(0)),
  weight: z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)), z.number().optional()),
  countryOfOrigin: z.string().optional(),
});

// NaN-safe optional number: converts NaN (from empty inputs) to undefined
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
  z.number().optional()
);

const customsFormSchema = z.object({
  type: z.enum(["IMPORT", "EXPORT"]),
  purchaseOrderId: z.string().optional(),
  salesOrderId: z.string().optional(),
  customsOffice: z.string().optional(),
  entryPort: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  destinationCountry: z.string().optional(),
  declaredValue: z.preprocess(
    (v) => (v === "" || Number.isNaN(v) ? 0 : Number(v)),
    z.number().min(0)
  ),
  currency: z.string().default("EUR"),
  dutyRate: optionalNumber,
  dutyAmount: optionalNumber,
  vatAmount: optionalNumber,
  otherCharges: optionalNumber,
  totalCost: optionalNumber,
  trackingNumber: z.string().optional(),
  shippingMethod: z.enum(["SEA", "AIR", "ROAD", "RAIL"]).optional(),
  estimatedArrival: z.string().optional(),
  brokerName: z.string().optional(),
  brokerContact: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(customsItemSchema).min(1, "At least one item is required"),
});

type CustomsFormValues = z.infer<typeof customsFormSchema>;

interface PurchaseOrderOption {
  id: string;
  poNumber: string;
  supplier: { name: string };
  status: string;
}

interface SalesOrderOption {
  id: string;
  orderNumber: string;
  customer: { name: string | null; companyName: string | null };
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CustomsDeclarationFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any;
  purchaseOrders: PurchaseOrderOption[];
  salesOrders: SalesOrderOption[];
}

export function CustomsDeclarationForm({
  initialData,
  purchaseOrders,
  salesOrders,
}: CustomsDeclarationFormProps) {
  const t = useTranslations("admin.customs");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const isEdit = !!initialData;

  const form = useForm<CustomsFormValues>({
    resolver: zodResolver(customsFormSchema),
    defaultValues: initialData
      ? {
          type: initialData.type || "IMPORT",
          purchaseOrderId: initialData.purchaseOrderId || "",
          salesOrderId: initialData.salesOrderId || "",
          customsOffice: initialData.customsOffice || "",
          entryPort: initialData.entryPort || "",
          countryOfOrigin: initialData.countryOfOrigin || "",
          destinationCountry: initialData.destinationCountry || "",
          declaredValue: Number(initialData.declaredValue) || 0,
          currency: initialData.currency || "EUR",
          dutyRate: initialData.dutyRate ? Number(initialData.dutyRate) : undefined,
          dutyAmount: initialData.dutyAmount ? Number(initialData.dutyAmount) : undefined,
          vatAmount: initialData.vatAmount ? Number(initialData.vatAmount) : undefined,
          otherCharges: initialData.otherCharges ? Number(initialData.otherCharges) : undefined,
          totalCost: initialData.totalCost ? Number(initialData.totalCost) : undefined,
          trackingNumber: initialData.trackingNumber || "",
          shippingMethod: initialData.shippingMethod || undefined,
          estimatedArrival: initialData.estimatedArrival
            ? new Date(initialData.estimatedArrival).toISOString().split("T")[0]
            : "",
          brokerName: initialData.brokerName || "",
          brokerContact: initialData.brokerContact || "",
          notes: initialData.notes || "",
          items: initialData.items?.map((item: {
            productName: string;
            sku?: string;
            hsCode?: string;
            quantity: number;
            unitPrice: number | { toNumber?: () => number };
            totalValue: number | { toNumber?: () => number };
            weight?: number | { toNumber?: () => number };
            countryOfOrigin?: string;
          }) => ({
            productName: item.productName,
            sku: item.sku || "",
            hsCode: item.hsCode || "",
            quantity: item.quantity,
            unitPrice: typeof item.unitPrice === "object" && item.unitPrice?.toNumber
              ? item.unitPrice.toNumber()
              : Number(item.unitPrice),
            totalValue: typeof item.totalValue === "object" && item.totalValue?.toNumber
              ? item.totalValue.toNumber()
              : Number(item.totalValue),
            weight: item.weight
              ? typeof item.weight === "object" && item.weight?.toNumber
                ? item.weight.toNumber()
                : Number(item.weight)
              : 0,
            countryOfOrigin: item.countryOfOrigin || "CN",
          })) || [{ productName: "", sku: "", hsCode: "", quantity: 1, unitPrice: 0, totalValue: 0, weight: 0, countryOfOrigin: "CN" }],
        }
      : {
          type: "IMPORT",
          purchaseOrderId: "",
          salesOrderId: "",
          customsOffice: "",
          entryPort: "",
          countryOfOrigin: "",
          destinationCountry: "ES",
          declaredValue: 0,
          currency: "EUR",
          trackingNumber: "",
          shippingMethod: undefined,
          estimatedArrival: "",
          brokerName: "",
          brokerContact: "",
          notes: "",
          items: [{ productName: "", sku: "", hsCode: "", quantity: 1, unitPrice: 0, totalValue: 0, weight: 0, countryOfOrigin: "CN" }],
        },
  });

  const watchType = form.watch("type");
  const watchPOId = form.watch("purchaseOrderId");

  async function handleAutoFillFromPO() {
    if (!watchPOId) return;
    setAutoFillLoading(true);
    try {
      const po = await getPurchaseOrderForCustoms(watchPOId);
      if (!po) {
        toast.error(t("toast.error"));
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = po.items.map((item: any) => {
        const product = item.variant?.product;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = product?.content as any;
        const productName = content?.en?.name || content?.es?.name || item.variant?.sku || "Unknown";

        return {
          productName,
          sku: item.variant?.sku || "",
          hsCode: product?.hsCode || "",
          quantity: item.quantity,
          unitPrice: Number(item.costPrice) || 0,
          totalValue: (Number(item.costPrice) || 0) * item.quantity,
          weight: 0,
          countryOfOrigin: "CN",
        };
      });

      form.setValue("items", items);
      form.setValue("countryOfOrigin", "CN");

      // Calculate total declared value
      const totalValue = items.reduce((sum: number, item: { totalValue: number }) => sum + item.totalValue, 0);
      form.setValue("declaredValue", Math.round(totalValue * 100) / 100);

      toast.success(t("toast.updated"));
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setAutoFillLoading(false);
    }
  }

  async function onSubmit(data: CustomsFormValues) {
    setLoading(true);
    try {
      // Clean optional empty strings
      const payload = {
        ...data,
        purchaseOrderId: data.purchaseOrderId || undefined,
        salesOrderId: data.salesOrderId || undefined,
        customsOffice: data.customsOffice || undefined,
        entryPort: data.entryPort || undefined,
        countryOfOrigin: data.countryOfOrigin || undefined,
        destinationCountry: data.destinationCountry || undefined,
        trackingNumber: data.trackingNumber || undefined,
        shippingMethod: data.shippingMethod || undefined,
        estimatedArrival: data.estimatedArrival || undefined,
        brokerName: data.brokerName || undefined,
        brokerContact: data.brokerContact || undefined,
        notes: data.notes || undefined,
      };

      const result = isEdit
        ? await updateCustomsDeclaration(initialData.id, payload)
        : await createCustomsDeclaration(payload);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      router.push("/admin/customs");
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Type & Related Order */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("form.type")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("form.type")}</Label>
            <Select
              value={watchType}
              onValueChange={(val) => form.setValue("type", val as "IMPORT" | "EXPORT")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMPORT">{t("type.IMPORT")}</SelectItem>
                <SelectItem value="EXPORT">{t("type.EXPORT")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchType === "IMPORT" ? (
            <div className="space-y-2">
              <Label>{t("form.purchase_order")}</Label>
              <div className="flex gap-2">
                <Select
                  value={watchPOId || ""}
                  onValueChange={(val) => form.setValue("purchaseOrderId", val === "__none__" ? "" : val)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("form.select_po")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{"—"}</SelectItem>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber} - {po.supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!watchPOId || autoFillLoading}
                  onClick={handleAutoFillFromPO}
                  className="shrink-0"
                >
                  {autoFillLoading ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="mr-1 h-3.5 w-3.5" />
                  )}
                  {t("form.auto_fill_po")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("form.sales_order")}</Label>
              <Select
                value={form.watch("salesOrderId") || ""}
                onValueChange={(val) => form.setValue("salesOrderId", val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("form.select_so")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{"—"}</SelectItem>
                  {salesOrders.map((so) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.orderNumber} - {so.customer.companyName || so.customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customs Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.customs_info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t("form.customs_office")}</Label>
            <Input {...form.register("customsOffice")} />
          </div>
          <div className="space-y-2">
            <Label>{t("form.entry_port")}</Label>
            <Input {...form.register("entryPort")} />
          </div>
          <div className="space-y-2">
            <Label>{t("form.country_of_origin")}</Label>
            <Input {...form.register("countryOfOrigin")} placeholder="CN" />
          </div>
          <div className="space-y-2">
            <Label>{t("form.destination_country")}</Label>
            <Input {...form.register("destinationCountry")} placeholder="ES" />
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.financial_info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("form.declared_value")} *</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("declaredValue", { valueAsNumber: true })}
            />
            {form.formState.errors.declaredValue && (
              <p className="text-xs text-red-500">{form.formState.errors.declaredValue.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{"Currency"}</Label>
            <Select
              value={form.watch("currency")}
              onValueChange={(val) => form.setValue("currency", val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("form.duty_rate")}</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("dutyRate", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("form.duty_amount")}</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("dutyAmount", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("form.vat_amount")}</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("vatAmount", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("form.other_charges")}</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("otherCharges", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("form.total_cost")}</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("totalCost", { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.logistics_info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("form.tracking_number")}</Label>
            <Input {...form.register("trackingNumber")} />
          </div>
          <div className="space-y-2">
            <Label>{t("form.shipping_method")}</Label>
            <Select
              value={form.watch("shippingMethod") || ""}
              onValueChange={(val) =>
                form.setValue(
                  "shippingMethod",
                  val === "__none__" ? undefined : (val as "SEA" | "AIR" | "ROAD" | "RAIL")
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("form.select_shipping")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{"—"}</SelectItem>
                <SelectItem value="SEA">{t("shipping_method.SEA")}</SelectItem>
                <SelectItem value="AIR">{t("shipping_method.AIR")}</SelectItem>
                <SelectItem value="ROAD">{t("shipping_method.ROAD")}</SelectItem>
                <SelectItem value="RAIL">{t("shipping_method.RAIL")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("form.estimated_arrival")}</Label>
            <Input type="date" {...form.register("estimatedArrival")} />
          </div>
        </CardContent>
      </Card>

      {/* Broker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.broker_info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("form.broker_name")}</Label>
            <Input {...form.register("brokerName")} />
          </div>
          <div className="space-y-2">
            <Label>{t("form.broker_contact")}</Label>
            <Input {...form.register("brokerContact")} />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("form.items")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomsItemsTable control={form.control} errors={form.formState.errors} />
          {form.formState.errors.items && typeof form.formState.errors.items.message === "string" && (
            <p className="mt-2 text-xs text-red-500">{form.formState.errors.items.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("form.notes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...form.register("notes")}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/customs")}>
          {t("detail.back")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? t("form.save") : t("actions.create")}
        </Button>
      </div>
    </form>
  );
}
