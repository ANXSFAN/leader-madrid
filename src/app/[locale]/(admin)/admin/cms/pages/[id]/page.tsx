import db from "@/lib/db";
import { notFound } from "next/navigation";
import { CmsPageForm } from "@/components/admin/cms/cms-page-form";

export default async function EditCmsPagePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const page = await db.cmsPage.findUnique({
    where: { id: params.id },
  });

  if (!page) notFound();

  return (
    <div className="space-y-6">
      <CmsPageForm initialData={JSON.parse(JSON.stringify(page))} />
    </div>
  );
}
