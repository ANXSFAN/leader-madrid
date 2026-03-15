import db from "@/lib/db";
import { AttributeForm } from "@/components/admin/attribute-form";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

interface AttributePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AttributePage(props: AttributePageProps) {
  const params = await props.params;
  const attribute = await db.attributeDefinition.findUnique({
    where: {
      id: params.id,
    },
    include: {
      options: true,
    },
  });

  if (!attribute) {
    notFound();
  }

  const t = await getTranslations("admin.attributes.form");

  return (
    <div className="flex-1 space-y-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title_edit")}</h2>
          <p className="text-muted-foreground">
            {t("subtitle_edit")}
          </p>
        </div>
        <Separator />
        <AttributeForm initialData={attribute} />
      </div>
    </div>
  );
}
