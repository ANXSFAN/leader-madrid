import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPriceLists, deletePriceList } from "@/lib/actions/price-list";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";

export default async function PriceListsPage() {
  const { priceLists } = await getPriceLists();
  const t = await getTranslations("admin.priceLists");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
            <Link href="/admin/price-lists/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("create")}
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.currency")}</TableHead>
              <TableHead>{t("table.level")}</TableHead>
              <TableHead>{t("table.discount")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.rules")}</TableHead>
              <TableHead>{t("table.users")}</TableHead>
              <TableHead>{t("table.last_updated")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceLists?.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/price-lists/${list.id}`}
                    className="hover:underline"
                  >
                    {list.name}
                  </Link>
                </TableCell>
                <TableCell>{list.currency}</TableCell>
                <TableCell>{list.levelCode || "-"}</TableCell>
                <TableCell>
                  {Number(list.discountPercent || 0).toFixed(2)}%
                </TableCell>
                <TableCell>
                  {list.isDefault ? (
                    <Badge variant="default">{t("table.default")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("table.custom")}</Badge>
                  )}
                </TableCell>
                <TableCell>{list._count.rules}</TableCell>
                <TableCell>{list._count.users}</TableCell>
                <TableCell>
                  {format(new Date(list.updatedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/price-lists/${list.id}`}>{t("table.edit")}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {priceLists?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  {t("table.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
