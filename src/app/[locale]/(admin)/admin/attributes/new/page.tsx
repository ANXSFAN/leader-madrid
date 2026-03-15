import { AttributeForm } from "@/components/admin/attribute-form";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";

export default async function NewAttributePage() {
  const t = await getTranslations("admin.attributes.form");
  return (
    <div className="flex-1 space-y-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title_create")}</h2>
          <p className="text-muted-foreground">
            {t("subtitle_create")}
          </p>
        </div>
        <Separator />
        <AttributeForm />
      </div>
    </div>
  );
}
