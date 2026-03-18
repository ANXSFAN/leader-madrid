"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCmsPages, deleteCmsPage } from "@/lib/actions/cms-pages";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

export default function CmsPagesListPage() {
  const t = useTranslations("admin.cms.pages");
  const [pages, setPages] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- filter is string from select
    const data = await getCmsPages((filter || undefined) as any);
    setPages(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const result = await deleteCmsPage(id);
    if (result.success) {
      toast.success(t("page_deleted"));
      loadData();
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "SOLUTION": return "bg-blue-100 text-blue-700";
      case "RESOURCE": return "bg-purple-100 text-purple-700";
      case "LEGAL": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[
          { label: "CMS", href: "/admin/cms/banners" },
          { label: t("title") },
        ]}
        actions={
          <Link href="/admin/cms/pages/new">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
              <Plus className="h-4 w-4 mr-2" /> {t("add_page")}
            </Button>
          </Link>
        }
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="">{t("filter_all")}</TabsTrigger>
          <TabsTrigger value="SOLUTION">{t("filter_solutions")}</TabsTrigger>
          <TabsTrigger value="LEGAL">{t("filter_legal")}</TabsTrigger>
          <TabsTrigger value="GENERAL">{t("filter_general")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_slug")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_type")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_menu_group")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_order")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_status")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground/60">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground/60">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              pages.map((page) => {
                const content = page.content as Record<string, any>;
                const title = content?.en?.title || page.slug;
                return (
                  <TableRow key={page.id} className="hover:bg-accent/5">
                    <TableCell>
                      <div>
                        <p className="font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground/60">/{page.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColor(page.type)}>{page.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{page.menuGroup || "—"}</TableCell>
                    <TableCell className="text-sm">{page.order}</TableCell>
                    <TableCell>
                      <Badge className={page.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {page.isActive ? t("status_active") : t("status_inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/admin/cms/pages/${page.id}`}>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(page.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
