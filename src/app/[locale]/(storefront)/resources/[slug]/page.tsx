import { getCmsPageBySlug } from "@/lib/actions/cms-pages";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

export default async function ResourcePage(
  props: {
    params: Promise<{ locale: string; slug: string }>;
  }
) {
  const params = await props.params;
  const page = await getCmsPageBySlug(params.slug);

  if (!page || page.type !== "RESOURCE" || !page.isActive) {
    notFound();
  }

  const t = await getTranslations("cmsPage");
  const content = page.content as Record<string, any>;
  const localized = content[params.locale] || content["en"] || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-yellow-600 mb-8">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t("back")}
      </Link>

      {page.imageUrl && (
        <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden mb-8">
          <Image
            src={page.imageUrl}
            alt={localized.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <h1 className="text-4xl font-black text-gray-900 mb-4">
        {localized.title || t("untitled")}
      </h1>

      {localized.description && (
        <p className="text-lg text-gray-600 mb-8">{localized.description}</p>
      )}

      {localized.body && (
        <div
          className="prose prose-lg max-w-none prose-headings:font-black prose-a:text-yellow-600"
          dangerouslySetInnerHTML={{ __html: localized.body }}
        />
      )}
    </div>
  );
}
