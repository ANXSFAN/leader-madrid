"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createPriceListRule } from "@/lib/actions/price-list";
import { searchVariants } from "@/lib/actions/search";
import { useTranslations } from "next-intl";

interface AddRuleDialogProps {
  priceListId: string;
}

export function AddRuleDialog({ priceListId }: AddRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [variants, setVariants] = useState<{ id: string; sku: string; productName: string; price: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.priceLists.addRule");

  const ruleSchema = z.object({
    priceListId: z.string(),
    variantId: z.string().min(1, t("validation_variant")),
    price: z.coerce.number().min(0, t("validation_price")),
    minQuantity: z.coerce.number().int().min(1).default(1),
  });

  const form = useForm<z.infer<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      priceListId,
      variantId: "",
      price: 0,
      minQuantity: 1,
    },
  });

  const onSearch = async (query: string) => {
    if (query.length < 2) return;
    const results = await searchVariants(query);
    setVariants(results);
  };

  async function onSubmit(values: z.infer<typeof ruleSchema>) {
    try {
      setLoading(true);
      const res = await createPriceListRule(values);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("toast_created"));
        setOpen(false);
        form.reset({
          priceListId,
          variantId: "",
          price: 0,
          minQuantity: 1,
        });
      }
    } catch (error) {
      toast.error(t("toast_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="variantId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("variant")}</FormLabel>
                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? variants.find(
                                (variant) => variant.id === field.value
                              )?.sku || t("select_variant")
                            : t("search_placeholder")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder={t("search_input")}
                          onValueChange={(val) => onSearch(val)}
                        />
                        <CommandList>
                            <CommandEmpty>{t("no_variant")}</CommandEmpty>
                            <CommandGroup>
                            {variants.map((variant) => (
                                <CommandItem
                                value={variant.id}
                                key={variant.id}
                                onSelect={() => {
                                    form.setValue("variantId", variant.id);
                                    form.setValue("price", variant.price);
                                    setSearchOpen(false);
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    variant.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">{variant.sku}</span>
                                    <span className="text-xs text-muted-foreground">{variant.productName}</span>
                                </div>
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("min_quantity")}</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("price")}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {t("save")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
