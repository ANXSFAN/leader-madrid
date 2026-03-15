import { getCustomerTags } from "@/lib/actions/customer-tags";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { CustomerTagsManager } from "@/components/admin/customer-tags-manager";

export const dynamic = "force-dynamic";

export default async function CustomerTagsPage() {
  const [result, t] = await Promise.all([
    getCustomerTags(),
    getTranslations("admin.customerTags"),
  ]);

  const tags = result.tags || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <CustomerTagsManager tags={tags} />
    </div>
  );
}
