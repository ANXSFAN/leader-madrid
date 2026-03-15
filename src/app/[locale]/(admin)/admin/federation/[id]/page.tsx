import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getFederationNodeDetail } from "@/lib/actions/federation";
import { PageHeader } from "@/components/admin/page-header";
import { FederationNodeDetail } from "@/components/admin/federation/federation-node-detail";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FederationNodePage(
  props: { params: Promise<{ locale: string; id: string }> }
) {
  const params = await props.params;
  const t = await getTranslations("admin.federation");

  const node = await getFederationNodeDetail(params.id);
  if (!node) return notFound();

  const suppliers = await db.supplier.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={node.name}
        description={`${t("node_code")}: ${node.code}`}
        breadcrumbs={[
          { label: t("title"), href: "/admin/federation" },
          { label: node.name },
        ]}
      />
      <FederationNodeDetail node={node} suppliers={suppliers} />
    </div>
  );
}
