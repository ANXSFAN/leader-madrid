"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Trash2, Search, Check, Loader2, FileText, Package, AlertTriangle } from "lucide-react";
import { createSalesOrder } from "@/lib/actions/sales-order";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/formatters";
import type { Product, ProductVariant } from "@prisma/client";

/** Shape of the Product.content JSON field */
interface ProductContentJson {
  [locale: string]: { name?: string } | undefined;
}

type ProductWithVariants = Product & { variants: ProductVariant[] };

interface SalesOrderFormProps {
  customers: { id: string; name: string | null; email: string; companyName: string | null }[];
  products: ProductWithVariants[];
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
  locale: string;
  currency: string;
}

export function SalesOrderForm({ customers, products, warehouses, locale, currency }: SalesOrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const t = useTranslations("admin.salesOrders.form");

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const soFormSchema = z.object({
    customerId: z.string().min(1, t("validation.customer_required")),
    warehouseId: z.string().min(1, t("validation.warehouse_required")),
    items: z.array(
      z.object({
        variantId: z.string().min(1, t("validation.variant_required")),
        quantity: z.coerce.number().min(1, t("validation.quantity_min")),
        unitPrice: z.coerce.number().min(0, t("validation.unit_price_min")),
        sku: z.string().optional(),
        name: z.string().optional(),
      })
    ).min(1, t("validation.items_min")),
  });

  type SOFormValues = z.infer<typeof soFormSchema>;

  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => {
      const content = p.content as ProductContentJson;
      const localeContent = content?.[locale] as { name?: string } | undefined;
      const enContent = content?.en as { name?: string } | undefined;
      const available = v.physicalStock - v.allocatedStock;
      return {
        id: v.id,
        sku: v.sku,
        name: localeContent?.name || enContent?.name || p.slug,
        currentPrice: v.b2bPrice || v.price,
        available,
      };
    })
  );

  const form = useForm<SOFormValues>({
    resolver: zodResolver(soFormSchema),
    defaultValues: {
      customerId: "",
      warehouseId: defaultWarehouse?.id || "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (data: SOFormValues) => {
    try {
      setLoading(true);
      setStockWarnings([]);
      const result = await createSalesOrder(data);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.stockWarnings && result.stockWarnings.length > 0) {
        toast.warning(t("toast.created_with_warnings"));
        setStockWarnings(result.stockWarnings);
      } else {
        toast.success(t("toast.created"));
      }

      router.push("/admin/sales-orders");
      router.refresh();
    } catch (error: unknown) {
      toast.error(t("toast.error"));
    } finally {
      setLoading(false);
    }
  };

  const addItem = (variantId: string) => {
    const variant = allVariants.find((v) => v.id === variantId);
    if (!variant) return;

    const existing = form.getValues("items").find((i) => i.variantId === variantId);
    if (existing) {
      toast.error(t("toast.item_exists"));
      return;
    }

    append({
      variantId: variant.id,
      quantity: 1,
      unitPrice: Number(variant.currentPrice) || 0,
      sku: variant.sku,
      name: variant.name,
    });
    setOpenCombobox(false);
  };

  const totalAmount = form.watch("items").reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    return acc + q * p;
  }, 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg border-l-4 border-yellow-500 pl-3">
              <FileText className="h-5 w-5 text-yellow-600" />
              {t("title_create")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("fields.customer")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("placeholders.customer")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((cust) => (
                        <SelectItem key={cust.id} value={cust.id}>
                          {cust.name || cust.email} {cust.companyName ? `(${cust.companyName})` : ""}
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
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("fields.warehouse")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("placeholders.warehouse")} />
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

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("fields.add_products")}</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {t("placeholders.variant")}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("placeholders.search")} />
                    <CommandList>
                      <CommandEmpty>{t("empty.search")}</CommandEmpty>
                      <CommandGroup>
                        {allVariants.slice(0, 50).map((variant) => (
                          <CommandItem
                            key={variant.id}
                            value={`${variant.sku} ${variant.name}`}
                            onSelect={() => addItem(variant.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.getValues("items").some(i => i.variantId === variant.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1">
                              <span className="font-medium text-sm">{variant.sku}</span>
                              <span className="text-xs text-muted-foreground">{variant.name}</span>
                            </div>
                            <span className={cn(
                              "text-xs font-mono ml-2",
                              variant.available <= 0 ? "text-red-500" : variant.available < 10 ? "text-yellow-600" : "text-green-600"
                            )}>
                              {t("table.stock")}: {variant.available}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Card className="border bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t("table.sku")}</TableHead>
                    <TableHead className="font-semibold">{t("table.quantity")}</TableHead>
                    <TableHead className="font-semibold">{t("table.unit_price")}</TableHead>
                    <TableHead className="font-semibold">{t("table.total")}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium">{field.sku}</span>
                          <span className="text-xs text-muted-foreground">{field.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  className="w-24 h-9"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-32 h-9 font-mono"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-medium">
                          {formatMoney(
                            (Number(form.watch(`items.${index}.quantity`)) || 0) *
                            (Number(form.watch(`items.${index}.unitPrice`)) || 0),
                            { locale, currency }
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fields.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <div className="rounded-full bg-muted p-3">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">{t("empty.items")}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {stockWarnings.length > 0 && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-800">{t("warnings.stock_title")}</p>
                    <ul className="text-sm text-yellow-700 list-disc pl-4 space-y-0.5">
                      {stockWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center gap-4 pt-4 border-t">
              <div className="text-lg font-semibold">
                {t("summary.total_label")}: <span className="font-mono">{formatMoney(totalAmount, { locale, currency })}</span>
              </div>
              <Button type="submit" disabled={loading || fields.length === 0} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black min-w-[160px]">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.creating")}
                  </>
                ) : t("actions.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
