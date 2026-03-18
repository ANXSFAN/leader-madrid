import db from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus, Star, SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { SortableAttributesTable } from "@/components/admin/sortable-attributes-table";

export const dynamic = "force-dynamic";

export default async function AttributesPage() {
  const t = await getTranslations("admin.attributes");
  const locale = await getLocale();
  const attributes = await db.attributeDefinition.findMany({
    include: { options: true },
    orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { key: "asc" }],
  });

  // 分组：高亮 → 筛选项 → 普通
  const highlighted = attributes.filter((a) => a.isHighlight);
  const filterable = attributes.filter((a) => !a.isHighlight && a.isFilterable);
  const regular = attributes.filter((a) => !a.isHighlight && !a.isFilterable);

  // Serialize for client component
  const serializeAttrs = (attrs: typeof attributes) =>
    attrs.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name as Record<string, string>,
      type: a.type,
      unit: a.unit,
      scope: a.scope,
      isHighlight: a.isHighlight,
      isFilterable: a.isFilterable,
      sortOrder: a.sortOrder,
      isPinned: a.isPinned,
      options: a.options.map((o) => ({ id: o.id, value: o.value, color: o.color })),
    }));

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/attributes/new">
            <Plus className="mr-2 h-4 w-4" /> {t("actions.add")}
          </Link>
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <Star className="h-4 w-4" />
            {t("groups.highlight")}
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900">{highlighted.length}</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <SlidersHorizontal className="h-4 w-4" />
            {t("groups.filterable")}
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-900">{filterable.length}</p>
        </div>
        <div className="rounded-lg border bg-secondary p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {t("groups.regular")}
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{regular.length}</p>
        </div>
      </div>

      {/* 分组表格（可拖拽排序） */}
      <SortableAttributesTable
        highlighted={serializeAttrs(highlighted)}
        filterable={serializeAttrs(filterable)}
        regular={serializeAttrs(regular)}
        locale={locale}
      />

      {attributes.length === 0 && (
        <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          {t("table.no_attributes")}
        </div>
      )}
    </div>
  );
}
