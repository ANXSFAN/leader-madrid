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
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Supplier } from "@prisma/client";
import { useTranslations } from "next-intl";

/** Shape of the Supplier.contact JSON field */
interface SupplierContactJson {
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
}

interface SupplierFormDialogProps {
  children: React.ReactNode;
  supplier?: Supplier;
}

export function SupplierFormDialog({ children, supplier }: SupplierFormDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("admin.suppliers.form");

  const formSchema = z.object({
    name: z.string().min(1, t("validation.name_required")),
    contactName: z.string().optional(),
    email: z.string().email(t("validation.email_invalid")).optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().url(t("validation.website_invalid")).optional().or(z.literal("")),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: supplier?.name || "",
      contactName: (supplier?.contact as SupplierContactJson | null)?.contactName || "",
      email: (supplier?.contact as SupplierContactJson | null)?.email || "",
      phone: (supplier?.contact as SupplierContactJson | null)?.phone || "",
      website: (supplier?.contact as SupplierContactJson | null)?.website || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (supplier) {
        await updateSupplier(supplier.id, values);
        toast.success(t("toast.updated"));
      } else {
        await createSupplier(values);
        toast.success(t("toast.created"));
      }
      setOpen(false);
      router.refresh();
      if (!supplier) form.reset();
    } catch (error) {
      toast.error(t("toast.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="border-l-4 border-accent pl-3">
            {supplier ? t("title_edit") : t("title_create")}
          </DialogTitle>
          <DialogDescription>
            {supplier
              ? t("description_edit")
              : t("description_create")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.contact_name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholders.contact_name")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.email")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholders.email")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.phone")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholders.phone")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.website")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholders.website")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">{t("actions.save")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
