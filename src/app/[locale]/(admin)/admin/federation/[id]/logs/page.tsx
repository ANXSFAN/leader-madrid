import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getFederationNodeDetail, getFederationSyncLogs } from "@/lib/actions/federation";
import { PageHeader } from "@/components/admin/page-header";
import { FederationSyncLogTable } from "@/components/admin/federation/federation-sync-log-table";

export const dynamic = "force-dynamic";

export default async function FederationNodeLogsPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
    searchParams: Promise<{ page?: string; entityType?: string; status?: string }>;
  }
) {
  const params = await props.params;
  const sp = await props.searchParams;
  const t = await getTranslations("admin.federation");

  const node = await getFederationNodeDetail(params.id);
  if (!node) return notFound();

  const page = parseInt(sp.page || "1", 10);
  const logsResult = await getFederationSyncLogs(params.id, {
    page,
    entityType: sp.entityType,
    status: sp.status,
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`${t("sync_logs")} — ${node.name}`}
        description={t("sync_logs_subtitle")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/federation" },
          { label: node.name, href: `/admin/federation/${params.id}` },
          { label: t("sync_logs") },
        ]}
      />
      <FederationSyncLogTable
        logs={logsResult.logs}
        total={logsResult.total}
        page={logsResult.page}
        totalPages={logsResult.totalPages}
        nodeId={params.id}
      />
    </div>
  );
}
