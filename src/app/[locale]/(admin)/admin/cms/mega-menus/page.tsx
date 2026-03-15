"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/admin/page-header";
import { MegaMenuForm } from "@/components/admin/cms/mega-menu-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGlobalConfig } from "@/lib/actions/config";

export default function MegaMenusPage() {
  const t = useTranslations("admin.cms.megaMenus");
  const [solutionsData, setSolutionsData] = useState<any>(null);
  const [resourcesData, setResourcesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sol, res] = await Promise.all([
        getGlobalConfig("mega_menu_solutions"),
        getGlobalConfig("mega_menu_resources"),
      ]);
      setSolutionsData(sol);
      setResourcesData(res);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[
          { label: "CMS", href: "/admin/cms/banners" },
          { label: t("title") },
        ]}
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400">{t("loading")}</div>
      ) : (
        <Tabs defaultValue="solutions">
          <TabsList>
            <TabsTrigger value="solutions">{t("solutions_menu")}</TabsTrigger>
            <TabsTrigger value="resources">{t("resources_menu")}</TabsTrigger>
          </TabsList>
          <TabsContent value="solutions" className="pt-4">
            <MegaMenuForm configKey="mega_menu_solutions" initialData={solutionsData} menuType="solutions" />
          </TabsContent>
          <TabsContent value="resources" className="pt-4">
            <MegaMenuForm configKey="mega_menu_resources" initialData={resourcesData} menuType="resources" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
