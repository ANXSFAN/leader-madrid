import { getShippingMethodById } from "@/lib/actions/shipping";
import { getSiteSettings } from "@/lib/actions/config";
import { ShippingMethodFormClient } from "../_components/shipping-method-form";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function EditShippingMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [method, settings, t] = await Promise.all([
    getShippingMethodById(id),
    getSiteSettings(),
    getTranslations("admin.shippingMethods"),
  ]);

  if (!method) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/shipping">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("not_found")}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <ShippingMethodFormClient
      currency={settings.currency}
      initialData={{
        id: method.id,
        name: method.name,
        description: method.description,
        price: method.price,
        estimatedDays: method.estimatedDays,
        isActive: method.isActive,
        isDefault: method.isDefault,
      }}
    />
  );
}
