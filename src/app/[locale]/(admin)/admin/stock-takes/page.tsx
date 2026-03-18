import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getStockTakes } from "@/lib/actions/stock-take";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  DRAFT: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export default async function StockTakesPage() {
  const [t, stockTakes] = await Promise.all([
    getTranslations("admin.stockTakes"),
    getStockTakes(),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/stock-takes/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.create")}
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.count_number")}</TableHead>
              <TableHead>{t("table.warehouse")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.total_variants")}</TableHead>
              <TableHead>{t("table.discrepancies")}</TableHead>
              <TableHead>{t("table.created_at")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockTakes.map((st) => (
              <TableRow key={st.id}>
                <TableCell className="font-medium">{st.stockTakeNumber}</TableCell>
                <TableCell>{st.warehouse.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[st.status] || "outline"}>
                    {st.status}
                  </Badge>
                </TableCell>
                <TableCell>{st.totalVariants}</TableCell>
                <TableCell>{st.totalDiscrepancies}</TableCell>
                <TableCell>{format(st.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/stock-takes/${st.id}`}>
                      {t("table.view")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {stockTakes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  {t("table.no_stock_takes")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
