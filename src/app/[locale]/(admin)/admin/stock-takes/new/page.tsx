import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { StockTakeNewForm } from "@/components/admin/stock-take-new-form";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

export default async function NewStockTakePage() {
  const [t, warehouses] = await Promise.all([
    getTranslations("admin.stockTakes"),
    getActiveWarehouses(),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("new_title")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/stock-takes" },
          { label: t("new_title") },
        ]}
      />
      <StockTakeNewForm warehouses={warehouses} />
    </div>
  );
}
