"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { quickCreateProduct } from "@/lib/actions/product";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

const formSchema = z.object({
  nameEs: z.string().min(1),
  nameEn: z.string().optional(),
  sku: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface QuickProductDialogProps {
  onCreated?: (product: { id: string; variantId: string; sku: string; name: string }) => void;
}

export function QuickProductDialog({ onCreated }: QuickProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.products.quickCreate");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nameEs: "",
      nameEn: "",
      sku: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = await quickCreateProduct(values);
      if (result.error) {
        toast.error(result.error);
      } else if (result.product) {
        toast.success(t("created"));
        onCreated?.(result.product);
        setOpen(false);
        form.reset();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Plus className="mr-2 h-4 w-4" />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="border-l-4 border-yellow-500 pl-3">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nameEs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name_es")} *</FormLabel>
                  <FormControl>
                    <Input placeholder="Bombilla LED 10W" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name_en")}</FormLabel>
                  <FormControl>
                    <Input placeholder="LED Bulb 10W" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sku")} *</FormLabel>
                  <FormControl>
                    <Input placeholder="LED-BULB-10W" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={loading}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("button")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
