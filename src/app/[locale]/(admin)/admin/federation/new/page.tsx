import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { FederationNodeForm } from "@/components/admin/federation/federation-node-form";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewFederationNodePage() {
  const [t, suppliers] = await Promise.all([
    getTranslations("admin.federation"),
    db.supplier.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("new_node")}
        description={t("new_node_subtitle")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/federation" },
          { label: t("new_node") },
        ]}
      />
      <FederationNodeForm suppliers={suppliers} />
    </div>
  );
}
