"use client";

import { useState } from "react";
import { syncAllProductsToIndex } from "@/lib/search/actions";
import { useTranslations } from "next-intl";

export default function SearchSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    synced?: number;
    total?: number;
    error?: string | null;
  } | null>(null);
  const t = useTranslations("admin.searchSync");

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await syncAllProductsToIndex();
      setResult(res);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            {t("syncing")}
          </>
        ) : (
          t("sync_all")
        )}
      </button>

      {result && !result.error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {t("sync_success", { synced: result.synced ?? 0, total: result.total ?? 0 })}
        </div>
      )}

      {result?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t("sync_error", { error: result.error })}
        </div>
      )}
    </div>
  );
}
