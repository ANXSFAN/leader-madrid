"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";

export function CreateBannerButton() {
  const t = useTranslations("admin.cms.banners");
  return (
    <Link href="/admin/cms/banners/new">
      <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
        <Plus className="mr-2 h-4 w-4" /> {t("add_banner")}
      </Button>
    </Link>
  );
}
