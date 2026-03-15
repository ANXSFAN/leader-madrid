import { getCategories } from "@/lib/actions/category";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Plus, Edit, FolderTree } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCategoryDialog } from "@/components/admin/delete-category-dialog";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const t = await getTranslations("admin.categories");
  const locale = await getLocale();
  const categories = await getCategories();

  type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number];
  type TreeRow = CategoryRow & { level: number };

  // Helper to build flattened tree
  const buildTree = (
    cats: CategoryRow[],
    parentId: string | null = null,
    level = 0
  ): TreeRow[] => {
    return cats
      .filter((c) => c.parentId === parentId)
      .flatMap((c) => {
        const children = buildTree(cats, c.id, level + 1);
        return [{ ...c, level }, ...children];
      });
  };

  const tree = buildTree(categories);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/admin/categories/new">
            <Plus className="mr-2 h-4 w-4" /> {t("actions.add")}
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.image")}</TableHead>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.icon")}</TableHead>
              <TableHead>{t("table.slug")}</TableHead>
              <TableHead>{t("table.parent")}</TableHead>
              <TableHead className="w-[100px] text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tree.map((cat) => {
              const catContent = cat.content as Record<string, unknown> | null;
              const icon = catContent?.icon as string | undefined;
              const imageUrl = catContent?.imageUrl as string | undefined;
              return (
                <TableRow key={cat.id}>
                  <TableCell>
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="object-cover rounded"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {/* Indentation */}
                      <div style={{ paddingLeft: `${cat.level * 24}px` }} />
                      <FolderTree className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cat.level === 0 ? "font-medium" : ""}>
                        {(catContent?.[locale] as Record<string, string> | undefined)?.name || (catContent?.en as Record<string, string> | undefined)?.name || (catContent?.es as Record<string, string> | undefined)?.name || t("unnamed")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {icon ? (
                      icon.startsWith("http") ? (
                        <Image
                          src={icon}
                          alt=""
                          width={20}
                          height={20}
                          className="object-contain"
                        />
                      ) : (
                        <span className="text-xs bg-slate-100 px-1 rounded">
                          {icon}
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {cat.slug}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cat.parent
                      ? (() => { const pc = cat.parent.content as Record<string, unknown> | null; return (pc?.[locale] as Record<string, string> | undefined)?.name || (pc?.en as Record<string, string> | undefined)?.name || (pc?.es as Record<string, string> | undefined)?.name || cat.parent.slug; })()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/categories/${cat.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteCategoryDialog category={cat} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {tree.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("table.no_categories")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
