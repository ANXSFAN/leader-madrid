import { PriceListForm } from "@/components/admin/price-list-form";
import { getTranslations } from "next-intl/server";

export default async function NewPriceListPage() {
  const t = await getTranslations("admin.priceLists.new_page");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <PriceListForm />
    </div>
  );
}
