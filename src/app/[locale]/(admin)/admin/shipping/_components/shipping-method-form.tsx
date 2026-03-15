"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Truck, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createShippingMethod, updateShippingMethod } from "@/lib/actions/shipping";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ShippingMethodFormProps {
  currency: string;
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    estimatedDays: number | null;
    isActive: boolean;
    isDefault: boolean;
  };
}

export function ShippingMethodFormClient({ currency, initialData }: ShippingMethodFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.shippingMethods");
  const isEdit = !!initialData;

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price?.toString() || "",
    estimatedDays: initialData?.estimatedDays?.toString() || "",
    isActive: initialData?.isActive ?? true,
    isDefault: initialData?.isDefault ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price) || 0,
        estimatedDays: formData.estimatedDays
          ? parseInt(formData.estimatedDays)
          : undefined,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      };

      const result = isEdit
        ? await updateShippingMethod({ id: initialData.id, ...payload })
        : await createShippingMethod(payload);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? t("toast.updated") : t("toast.created"));
        router.push("/admin/shipping");
        router.refresh();
      }
    } catch (error) {
      toast.error(isEdit ? t("toast.update_error") : t("toast.create_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/admin/shipping">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? t("edit_title") : t("new_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("card_desc")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 max-w-2xl">
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg border-l-4 border-yellow-500 pl-3">
                <Truck className="h-5 w-5 text-yellow-600" />
                {t("card_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  {t("fields.name")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t("placeholders.name")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="transition-colors focus:border-yellow-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">{t("fields.description")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("placeholders.description")}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    {t("fields.price", { currency })} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t("placeholders.price")}
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedDays" className="text-sm font-medium">{t("fields.estimated_days")}</Label>
                  <Input
                    id="estimatedDays"
                    type="number"
                    min="1"
                    placeholder={t("placeholders.estimated_days")}
                    value={formData.estimatedDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimatedDays: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                      {t("fields.active")}
                    </Label>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                </div>

                <div className="border-t pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <Label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">
                      {t("fields.set_default")}
                    </Label>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isDefault: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" asChild>
              <Link href="/admin/shipping">{t("actions.cancel")}</Link>
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black min-w-[160px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("actions.saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEdit ? t("actions.save_changes") : t("actions.save")}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
