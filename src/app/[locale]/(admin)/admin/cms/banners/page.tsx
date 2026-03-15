import { getBanners } from "@/lib/actions/cms";
import { BannerList } from "@/components/admin/cms/banner-list";
import { CreateBannerButton } from "@/components/admin/cms/create-banner-button";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

export default async function BannersPage() {
  const banners = await getBanners();
  const t = await getTranslations("admin.cms.banners");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("page_title")}
        description={t("page_description")}
        actions={<CreateBannerButton />}
      />

      <BannerList banners={banners} />
    </div>
  );
}
