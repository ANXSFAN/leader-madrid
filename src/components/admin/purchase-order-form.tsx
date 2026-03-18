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
import { Trash2, Search, Check, Loader2, ShoppingCart, Package, ChevronDown, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseOrder } from "@/lib/actions/purchase-order";
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
import { QuickProductDialog } from "./quick-product-dialog";

const poFormSchema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.coerce.number().min(1),
      costPrice: z.coerce.number().min(0),
      sku: z.string().optional(),
      name: z.string().optional(),
    })
  ).min(1),
  customsDeclarationNumber: z.string().optional(),
  customsClearedAt: z.string().optional(),
  dutyAmount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  customsServiceFee: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  customsNotes: z.string().optional(),
});

type POFormValues = z.infer<typeof poFormSchema>;

interface PurchaseOrderFormProps {
  suppliers: { id: string; name: string }[];
  products: any[];
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
  locale: string;
  currency: string;
}

export function PurchaseOrderForm({ suppliers, products, warehouses, locale, currency }: PurchaseOrderFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.purchaseOrders");
  const [loading, setLoading] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const allVariants = products.flatMap((p) =>
    p.variants.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      name: (p.content as any)?.[locale]?.name || (p.content as any)?.en?.name || p.slug,
      currentCost: v.costPrice,
    }))
  );

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      supplierId: "",
      warehouseId: defaultWarehouse?.id || "",
      items: [],
      customsDeclarationNumber: "",
      customsClearedAt: "",
      dutyAmount: undefined,
      customsServiceFee: undefined,
      customsNotes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (data: POFormValues) => {
    try {
      setLoading(true);
      const result = await createPurchaseOrder(data);
      if (result.error) { toast.error(result.error); return; }
      toast.success(t("form.toast.created"));
      router.push("/admin/purchase-orders");
      router.refresh();
    } catch {
      toast.error(t("form.toast.error"));
    } finally {
      setLoading(false);
    }
  };

  const addItem = (variantId: string) => {
    const variant = allVariants.find((v) => v.id === variantId);
    if (!variant) return;
    if (form.getValues("items").find((i) => i.variantId === variantId)) {
      toast.error(t("form.toast.item_exists"));
      return;
    }
    append({ variantId: variant.id, quantity: 1, costPrice: Number(variant.currentCost) || 0, sku: variant.sku, name: variant.name });
    setOpenCombobox(false);
  };

  const totalAmount = form.watch("items").reduce((acc, item) => {
    return acc + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0);
  }, 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg border-l-4 border-accent pl-3">
              <ShoppingCart className="h-5 w-5 text-accent" />
              {t("form.title_create")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("form.supplier")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.select_supplier")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
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
                  <FormLabel className="text-sm font-medium">{t("form.warehouse")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.select_warehouse")} />
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

            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">{t("form.add_products")}</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openCombobox} className="w-full justify-between">
                    {t("form.select_variant")}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("form.search")} />
                    <CommandList>
                      <CommandEmpty>{t("form.no_product")}</CommandEmpty>
                      <CommandGroup>
                        {allVariants.slice(0, 50).map((variant) => (
                          <CommandItem key={variant.id} value={`${variant.sku} ${variant.name}`} onSelect={() => addItem(variant.id)}>
                            <Check className={cn("mr-2 h-4 w-4", form.getValues("items").some(i => i.variantId === variant.id) ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{variant.sku}</span>
                              <span className="text-xs text-muted-foreground">{variant.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
              <QuickProductDialog
                onCreated={(product) => {
                  if (product.variantId) {
                    append({
                      variantId: product.variantId,
                      quantity: 1,
                      costPrice: 0,
                      sku: product.sku,
                      name: product.name,
                    });
                  }
                }}
              />
            </div>

            <Card className="border bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t("form.table.sku")}</TableHead>
                    <TableHead className="font-semibold">{t("form.table.quantity")}</TableHead>
                    <TableHead className="font-semibold">{t("form.table.cost_price")}</TableHead>
                    <TableHead className="font-semibold">{t("form.table.total")}</TableHead>
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
                                <Input type="number" min="1" className="w-24 h-9" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.costPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" min="0" step="0.01" className="w-32 h-9 font-mono" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-medium">
                          {formatMoney((Number(form.watch(`items.${index}.quantity`)) || 0) * (Number(form.watch(`items.${index}.costPrice`)) || 0), { locale, currency })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => remove(index)}>
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
                          <p className="text-sm text-muted-foreground">{t("form.items_empty")}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Import / Customs Info — collapsible, default closed */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
                <Shield className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t("customs.section_title")}</span>
                <ChevronDown className="chevron h-4 w-4 shrink-0 transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customsDeclarationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customs.declaration_number")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customsClearedAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customs.cleared_at")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dutyAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customs.duty_amount")}</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" className="font-mono" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customsServiceFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customs.service_fee")}</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" className="font-mono" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="customsNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("customs.notes")}</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder={t("customs.notes_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end items-center gap-4 pt-4 border-t">
              <div className="text-lg font-semibold">
                {t("form.total_label")}: <span className="font-mono">{formatMoney(totalAmount, { locale, currency })}</span>
              </div>
              <Button type="submit" disabled={loading || fields.length === 0} className="bg-accent hover:bg-accent/90 text-accent-foreground font-black min-w-[160px]">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("form.creating")}
                  </>
                ) : t("form.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
