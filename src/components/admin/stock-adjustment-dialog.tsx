"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { adjustStock } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Package, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Zod Schema for validation
const createFormSchema = (t: (key: string) => string) =>
  z.object({
    warehouseId: z.string().min(1, t("inventory.adjust.warehouse_required")),
    type: z.enum([
      "PURCHASE_ORDER",
      "SALE_ORDER",
      "ADJUSTMENT",
      "RETURN",
      "DAMAGED",
    ]),
    quantity: z.coerce
      .number()
      .int()
      .refine((val) => val !== 0, t("inventory.adjust.validation_zero")),
    reference: z.string().optional(),
    note: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

export interface StockAdjustmentDialogProps {
  variantId: string;
  sku: string;
  currentStock: number;
  productName?: string;
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}

export function StockAdjustmentDialog({
  variantId,
  sku,
  currentStock,
  productName,
  warehouses,
}: StockAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("admin");
  const formSchema = useMemo(() => createFormSchema(t), [t]);

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: defaultWarehouse?.id || "",
      type: "PURCHASE_ORDER",
      quantity: 1,
      reference: "",
      note: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);

    // Calculate final quantity based on type (signed value)
    let finalQty = data.quantity;

    // For specific types, we enforce direction regardless of input sign
    if (data.type === "SALE_ORDER" || data.type === "DAMAGED") {
      finalQty = -Math.abs(data.quantity);
    } else if (data.type === "PURCHASE_ORDER" || data.type === "RETURN") {
      finalQty = Math.abs(data.quantity);
    }
    // For ADJUSTMENT, we respect the sign (allows + or -)

    const result = await adjustStock(
      variantId,
      finalQty,
      data.type,
      data.reference,
      data.note,
      data.warehouseId
    );

    if (result.success) {
      toast.success(t("common.messages.save_success"));
      setOpen(false);
      form.reset();
      router.refresh();
    } else {
      toast.error(result.error || t("common.messages.save_error"));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Package className="mr-2 h-3.5 w-3.5" />
          {t("inventory.adjust.title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card dark:bg-slate-900 text-foreground dark:text-slate-50 z-[100]">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-50 border-l-4 border-accent pl-3">
            {t("inventory.adjust.title")}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {productName} <br />
            {t("inventory.table.sku")}: <span className="font-mono font-medium">{sku}</span> • {t("inventory.adjust.current")}:{" "}
            <span className="font-bold">{currentStock}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.adjust.warehouse_label")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("inventory.adjust.select_warehouse")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.adjust.type_label")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("inventory.adjust.select_type")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADJUSTMENT">
                        {t("inventory.type.ADJUSTMENT")}
                      </SelectItem>
                      <SelectItem value="DAMAGED">
                        {t("inventory.type.DAMAGED")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.adjust.quantity")}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.table.reference")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("inventory.adjust.reference_placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.adjust.note")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("inventory.adjust.placeholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
