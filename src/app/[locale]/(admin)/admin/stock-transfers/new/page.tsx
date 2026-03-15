import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StockTransferForm } from "@/components/admin/stock-transfer-form";

export const dynamic = "force-dynamic";

export default async function NewStockTransferPage() {
  const [warehouses, t] = await Promise.all([
    getActiveWarehouses(),
    getTranslations("admin.stock_transfers"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("actions.new")}
        description={t("new_subtitle")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/stock-transfers" },
          { label: t("actions.new") },
        ]}
      />

      <StockTransferForm warehouses={warehouses} />
    </div>
  );
}
