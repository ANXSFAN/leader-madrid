import db from "@/lib/db";
import { notFound } from "next/navigation";
import { BannerForm } from "@/components/admin/cms/banner-form";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

interface EditBannerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditBannerPage(props: EditBannerPageProps) {
  const params = await props.params;
  const banner = await db.banner.findUnique({
    where: { id: params.id },
  });

  if (!banner) {
    notFound();
  }

  const t = await getTranslations("admin.cms.banners");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("edit_title")}
        description={t("edit_description", { title: banner.title })}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "CMS" },
          { label: t("page_title"), href: "/admin/cms/banners" },
          { label: t("edit_title") },
        ]}
      />
      <BannerForm initialData={banner} />
    </div>
  );
}
