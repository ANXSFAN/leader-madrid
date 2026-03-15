import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { ReorderSuggestionsTable } from "@/components/admin/reorder-suggestions-table";
import { getReorderSuggestions, getReorderStats } from "@/lib/actions/reorder-suggestions";
import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { getTranslations, getLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { AlertTriangle, PackageX, AlertCircle } from "lucide-react";

export default async function ReorderSuggestionsPage() {
  const [t, locale, settings, suggestionsResult, statsResult, warehouses] = await Promise.all([
    getTranslations("admin.reorderSuggestions"),
    getLocale(),
    getSiteSettings(),
    getReorderSuggestions(),
    getReorderStats(),
    getActiveWarehouses(),
  ]);
  const currency = settings.currency;

  const suggestions = "error" in suggestionsResult ? [] : suggestionsResult;
  const stats = "error" in statsResult ? null : statsResult;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader title={t("title")} />

      {stats && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <StatCard
            title={t("stats.below_reorder")}
            value={stats.totalBelowReorderPoint}
            icon={AlertTriangle}
            color="yellow"
          />
          <StatCard
            title={t("stats.out_of_stock")}
            value={stats.totalOutOfStock}
            icon={PackageX}
            color="red"
          />
          <StatCard
            title={t("stats.low_stock")}
            value={stats.totalLowStock}
            icon={AlertCircle}
            color="amber"
          />
        </div>
      )}

      <ReorderSuggestionsTable
        suggestions={suggestions}
        warehouses={warehouses}
        locale={locale}
        currency={currency}
      />
    </div>
  );
}
