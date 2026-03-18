import { IS_TYPESENSE_ENABLED } from "@/lib/search/typesense-client";
import SearchSyncButton from "./sync-button";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

export default async function SearchSyncPage() {
  const t = await getTranslations("admin.searchSync");

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{t("status_label")}:</span>
          {IS_TYPESENSE_ENABLED ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-800">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t("status_connected")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              {t("status_disabled")}
            </span>
          )}
        </div>

        {IS_TYPESENSE_ENABLED ? (
          <SearchSyncButton />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("env_hint")}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t("how_title")}</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
          <li>{t("how_1")}</li>
          <li>{t("how_2")}</li>
          <li>{t("how_3")}</li>
          <li>{t("how_4")}</li>
        </ul>
      </div>
    </div>
  );
}
