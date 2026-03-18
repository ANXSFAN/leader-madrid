import { getTranslations } from "next-intl/server";
import { getFederationNodes, getFederationStats } from "@/lib/actions/federation";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FederationNodeTable } from "@/components/admin/federation/federation-node-table";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Network, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FederationPage() {
  const [t, nodes, stats] = await Promise.all([
    getTranslations("admin.federation"),
    getFederationNodes(),
    getFederationStats(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link href="/admin/federation/new">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
              <Plus className="mr-2 h-4 w-4" />
              {t("add_node")}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title={t("total_nodes")}
          value={stats.totalNodes}
          icon={Network}
          color="blue"
        />
        <StatCard
          title={t("active_nodes")}
          value={stats.activeNodes}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title={t("pending_nodes")}
          value={stats.pendingNodes}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title={t("failed_syncs_24h")}
          value={stats.failedSyncsLast24h}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <FederationNodeTable nodes={nodes} />
    </div>
  );
}
