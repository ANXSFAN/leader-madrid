import { BannerForm } from "@/components/admin/cms/banner-form";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

export default async function NewBannerPage() {
  const t = await getTranslations("admin.cms.banners");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("create_title")}
        description={t("create_description")}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "CMS" },
          { label: t("page_title"), href: "/admin/cms/banners" },
          { label: t("create_title") },
        ]}
      />
      <BannerForm />
    </div>
  );
}
