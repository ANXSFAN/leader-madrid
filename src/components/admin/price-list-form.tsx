"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createPriceList, updatePriceList } from "@/lib/actions/price-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceList } from "@prisma/client";
import { useTranslations } from "next-intl";

interface PriceListFormProps {
  initialData?: PriceList | null;
}

export function PriceListForm({ initialData }: PriceListFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.priceLists.form");

  const priceListSchema = z.object({
    name: z.string().min(1, t("validation.name_required")),
    currency: z.string().default("EUR"),
    isDefault: z.boolean().default(false),
    levelCode: z.string().optional().nullable(),
    discountPercent: z.coerce
      .number()
      .min(0, t("validation.discount_min"))
      .max(100, t("validation.discount_max"))
      .default(0),
  });

  const form = useForm<z.infer<typeof priceListSchema>>({
    resolver: zodResolver(priceListSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          currency: initialData.currency,
          isDefault: initialData.isDefault,
          levelCode: initialData.levelCode || "",
          discountPercent: Number(initialData.discountPercent || 0),
        }
      : {
          name: "",
          currency: "EUR",
          isDefault: false,
          levelCode: "",
          discountPercent: 0,
        },
  });

  async function onSubmit(values: z.infer<typeof priceListSchema>) {
    try {
      setLoading(true);
      if (initialData) {
        const res = await updatePriceList(initialData.id, values);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(t("toast.updated"));
          router.refresh();
          router.push("/admin/price-lists");
        }
      } else {
        const res = await createPriceList(values);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(t("toast.created"));
          router.refresh();
          router.push(`/admin/price-lists/${res.priceList?.id}`);
        }
      }
    } catch (error) {
      toast.error(t("toast.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader>
        <CardTitle className="border-l-4 border-yellow-500 pl-3">
          {initialData ? t("title_edit") : t("title_create")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("placeholders.name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.currency")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("placeholders.currency")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="levelCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.level_code")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("placeholders.level_code")} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>
                      {t("descriptions.level_code")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.discount_percent")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("descriptions.discount_percent")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t("fields.is_default")}
                      </FormLabel>
                      <FormDescription>
                        {t("descriptions.is_default")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <Button disabled={loading} type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
              {initialData ? t("actions.save") : t("actions.create")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
