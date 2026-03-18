"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { createWarehouse, updateWarehouse, deleteWarehouse } from "@/lib/actions/warehouse";
import { Warehouse } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Save, Trash2, Loader2 } from "lucide-react";

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9\-]+$/, "Code must be uppercase alphanumeric with dashes"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

interface WarehouseFormProps {
  warehouse?: Warehouse;
}

export function WarehouseForm({ warehouse }: WarehouseFormProps) {
  const t = useTranslations("admin.warehouses");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !warehouse;

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: warehouse?.name || "",
      code: warehouse?.code || "",
      address: warehouse?.address || "",
      city: warehouse?.city || "",
      country: warehouse?.country || "",
      isDefault: warehouse?.isDefault ?? false,
      isActive: warehouse?.isActive ?? true,
    },
  });

  async function onSubmit(values: WarehouseFormValues) {
    setLoading(true);
    setError(null);
    try {
      const result = isNew
        ? await createWarehouse(values)
        : await updateWarehouse(warehouse.id, values);

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/warehouses");
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!confirm(t("delete_confirm"))) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteWarehouse(warehouse!.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/warehouses");
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="border-l-4 border-accent pl-3">
            {isNew ? t("form.title_new") : t("form.title_edit")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.name")} *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder={t("form.name_placeholder")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">{t("form.code")} *</Label>
              <Input
                id="code"
                {...form.register("code")}
                placeholder="WH-MAIN"
                className="font-mono uppercase"
              />
              {form.formState.errors.code && (
                <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">{t("form.address")}</Label>
              <Input
                id="address"
                {...form.register("address")}
                placeholder={t("form.address_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("form.city")}</Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder={t("form.city_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("form.country")}</Label>
              <Input
                id="country"
                {...form.register("country")}
                placeholder={t("form.country_placeholder")}
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(val) => form.setValue("isActive", val)}
              />
              <Label htmlFor="isActive">{t("form.is_active")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isDefault"
                checked={form.watch("isDefault")}
                onCheckedChange={(val) => form.setValue("isDefault", val)}
              />
              <Label htmlFor="isDefault">{t("form.is_default")}</Label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={loading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isNew ? t("form.create") : t("form.save")}
            </Button>

            {!isNew && (
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("form.delete")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
