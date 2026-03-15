"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { searchVariants } from "@/lib/actions/search";
import { createQuickStockIn, getLastPurchasePrice } from "@/lib/actions/purchase-stock-in";

const itemSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.coerce.number().int().min(1),
  costPrice: z.coerce.number().min(0),
});

const formSchema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  reference: z.string().optional(),
  note: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface PurchaseStockInFormProps {
  suppliers: { id: string; name: string }[];
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}

export function PurchaseStockInForm({
  suppliers,
  warehouses,
}: PurchaseStockInFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.purchaseStockIn");
  const [loading, setLoading] = useState(false);

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: "",
      warehouseId: defaultWarehouse?.id || "",
      reference: "",
      note: "",
      items: [{ variantId: "", sku: "", productName: "", quantity: 1, costPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const grandTotal = watchItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.costPrice || 0),
    0
  );

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    const result = await createQuickStockIn({
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      reference: data.reference,
      note: data.note,
      items: data.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        costPrice: item.costPrice,
      })),
    });

    if (result.success) {
      toast.success(t("success"));
      router.push("/admin/purchase-stock-in");
    } else {
      toast.error(result.error || t("error"));
    }
    setLoading(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="border-l-4 border-yellow-500 pl-3">
              {t("form.basic_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.supplier")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.select_supplier")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
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
                  <FormLabel>{t("form.warehouse")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.select_warehouse")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
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
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.reference")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("form.reference_placeholder")} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("form.note")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("form.note_placeholder")} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="border-l-4 border-yellow-500 pl-3">
                {t("form.items")}
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({ variantId: "", sku: "", productName: "", quantity: 1, costPrice: 0 })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> {t("form.add_item")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">{t("form.product")}</TableHead>
                    <TableHead className="w-[100px]">{t("form.qty")}</TableHead>
                    <TableHead className="w-[120px]">{t("form.unit_price")}</TableHead>
                    <TableHead className="w-[120px]">{t("form.subtotal")}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <StockInItemRow
                      key={field.id}
                      index={index}
                      form={form}
                      onRemove={() => remove(index)}
                      canRemove={fields.length > 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end mt-4 text-lg font-bold">
              {t("form.grand_total")}: {grandTotal.toFixed(2)} EUR
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("form.submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function StockInItemRow({
  index,
  form,
  onRemove,
  canRemove,
}: {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const t = useTranslations("admin.purchaseStockIn");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [variants, setVariants] = useState<
    { id: string; sku: string; productName: string; physicalStock: number; price: number; costPrice: number }[]
  >([]);

  const watchedItem = form.watch(`items.${index}`);
  const subtotal = (watchedItem.quantity || 0) * (watchedItem.costPrice || 0);

  useEffect(() => {
    const fetchVariants = async () => {
      if (debouncedQuery.length < 2) {
        setVariants([]);
        return;
      }
      const results = await searchVariants(debouncedQuery);
      setVariants(results);
    };
    fetchVariants();
  }, [debouncedQuery]);

  return (
    <TableRow>
      <TableCell>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
              {watchedItem.variantId
                ? `${watchedItem.sku} - ${watchedItem.productName}`
                : t("form.search_product")}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t("form.search_placeholder")}
                onValueChange={setSearchQuery}
                value={searchQuery}
              />
              <CommandList>
                <CommandEmpty>{t("form.no_product_found")}</CommandEmpty>
                <CommandGroup>
                  {variants.map((v) => (
                    <CommandItem
                      key={v.id}
                      value={v.id}
                      onSelect={async () => {
                        form.setValue(`items.${index}.variantId`, v.id);
                        form.setValue(`items.${index}.sku`, v.sku);
                        form.setValue(`items.${index}.productName`, v.productName);
                        setSearchOpen(false);
                        // Fetch last actual purchase price (not weighted average)
                        const lastPrice = await getLastPurchasePrice(v.id);
                        form.setValue(`items.${index}.costPrice`, lastPrice ?? (v.costPrice || 0));
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          watchedItem.variantId === v.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{v.sku}</span>
                        <span className="text-xs text-muted-foreground">{v.productName}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min={0}
          {...form.register(`items.${index}.costPrice`, { valueAsNumber: true })}
        />
      </TableCell>
      <TableCell className="font-mono text-sm">{subtotal.toFixed(2)}</TableCell>
      <TableCell>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
