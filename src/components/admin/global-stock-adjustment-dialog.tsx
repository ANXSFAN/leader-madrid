"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { adjustStock } from "@/lib/actions/inventory";
import { searchVariants } from "@/lib/actions/search";
import { useDebounce } from "@/hooks/use-debounce";
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
import {
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface GlobalStockAdjustmentDialogProps {
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}

export function GlobalStockAdjustmentDialog({ warehouses }: GlobalStockAdjustmentDialogProps) {
  const t = useTranslations("admin");
  const adj = "inventory.adjust";

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const formSchema = useMemo(
    () =>
      z.object({
        warehouseId: z.string().min(1, t(`${adj}.warehouse_required`)),
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
          .refine((val) => val !== 0, t(`${adj}.validation_zero`)),
        reference: z.string().optional(),
        note: z.string().optional(),
      }),
    [t]
  );

  type FormValues = z.infer<typeof formSchema>;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const [variants, setVariants] = useState<
    {
      id: string;
      sku: string;
      productName: string;
      physicalStock: number;
      price: number;
    }[]
  >([]);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    sku: string;
    productName: string;
    physicalStock: number;
    price: number;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: defaultWarehouse?.id || "",
      type: "ADJUSTMENT",
      quantity: 1,
      reference: "",
      note: "",
    },
  });

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

  const onSubmit = async (data: FormValues) => {
    if (!selectedVariant) {
      toast.error(t(`${adj}.error_no_variant`));
      return;
    }

    setLoading(true);

    let finalQty = data.quantity;
    if (data.type === "SALE_ORDER" || data.type === "DAMAGED") {
      finalQty = -Math.abs(data.quantity);
    } else if (data.type === "PURCHASE_ORDER" || data.type === "RETURN") {
      finalQty = Math.abs(data.quantity);
    }

    const result = await adjustStock(
      selectedVariant.id,
      finalQty,
      data.type,
      data.reference,
      data.note,
      data.warehouseId
    );

    if (result.success) {
      toast.success(t(`${adj}.success_updated`));
      setOpen(false);
      form.reset();
      setSelectedVariant(null);
    } else {
      toast.error(result.error || t(`${adj}.error_failed`));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="mr-2 h-4 w-4" /> {t(`${adj}.new_button`)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="border-l-4 border-yellow-500 pl-3">
            {t(`${adj}.new_title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`${adj}.new_description`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Variant search */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              {t(`${adj}.select_variant`)}
            </label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedVariant
                    ? `${selectedVariant.sku} - ${selectedVariant.productName}`
                    : t(`${adj}.search_placeholder`)}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t(`${adj}.search_input`)}
                    onValueChange={setSearchQuery}
                    value={searchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>{t(`${adj}.no_variant_found`)}</CommandEmpty>
                    <CommandGroup>
                      {variants.map((variant) => (
                        <CommandItem
                          value={variant.id}
                          key={variant.id}
                          onSelect={() => {
                            setSelectedVariant(variant);
                            setSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVariant?.id === variant.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{variant.sku}</span>
                            <span className="text-xs text-muted-foreground">
                              {variant.productName}
                            </span>
                          </div>
                          <div className="ml-auto font-mono text-xs">
                            {t(`${adj}.stock_label`)}: {variant.physicalStock}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Current stock badge */}
          {selectedVariant && (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
              {t(`${adj}.current`)}:{" "}
              <span className="font-bold text-slate-900">
                {selectedVariant.physicalStock}
              </span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`${adj}.warehouse_label`)}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t(`${adj}.select_warehouse`)} />
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`${adj}.type_label`)}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t(`${adj}.select_type`)} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADJUSTMENT">
                            {t(`${adj}.type_ADJUSTMENT_desc`)}
                          </SelectItem>
                          <SelectItem value="DAMAGED">
                            {t(`${adj}.type_DAMAGED_desc`)}
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
                      <FormLabel>{t(`${adj}.quantity`)}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`${adj}.reference_label`)}</FormLabel>
                    <FormControl>
                      <Input placeholder={t(`${adj}.reference_placeholder`)} {...field} />
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
                    <FormLabel>{t(`${adj}.note_label`)}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(`${adj}.placeholder`)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={loading || !selectedVariant}
                  className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t(`${adj}.save_button`)}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
