import { getSiteSettings } from "@/lib/actions/config";
import { SiteInfoForm } from "./site-info-form";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";

export default async function SiteInfoPage() {
  const [settings, t] = await Promise.all([
    getSiteSettings(),
    getTranslations("admin.cms.siteInfo"),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
      />
      <div className="max-w-2xl">
        <SiteInfoForm initialData={settings} />
      </div>
    </div>
  );
}
