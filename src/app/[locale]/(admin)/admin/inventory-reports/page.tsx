import { PageHeader } from "@/components/admin/page-header";
import { InventoryReportsTabs } from "@/components/admin/inventory-reports-tabs";
import { getTranslations, getLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";

export default async function InventoryReportsPage() {
  const [t, locale, settings] = await Promise.all([
    getTranslations("admin.inventoryReports"),
    getLocale(),
    getSiteSettings(),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader title={t("title")} />
      <InventoryReportsTabs locale={locale} currency={currency} />
    </div>
  );
}
