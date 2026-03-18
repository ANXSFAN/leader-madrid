import { getStockTransfers } from "@/lib/actions/warehouse";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, ArrowLeftRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/formatters";
import { StockTransferActions } from "@/components/admin/stock-transfer-actions";

export const dynamic = "force-dynamic";

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-700";
    case "IN_TRANSIT":
      return "bg-blue-100 text-blue-700";
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
    default:
      return "";
  }
}

export default async function StockTransfersPage(
  props: { params: Promise<{ locale: string }> }
) {
  const params = await props.params;
  const [transfers, t] = await Promise.all([
    getStockTransfers(),
    getTranslations("admin.stock_transfers"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/stock-transfers/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.new")}
            </Link>
          </Button>
        }
      />

      {transfers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-3">{t("empty")}</p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
              <Link href="/admin/stock-transfers/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.new")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">{t("table.number")}</TableHead>
                <TableHead className="font-semibold">{t("table.route")}</TableHead>
                <TableHead className="font-semibold">{t("table.items")}</TableHead>
                <TableHead className="font-semibold">{t("table.status")}</TableHead>
                <TableHead className="font-semibold">{t("table.created")}</TableHead>
                <TableHead className="font-semibold">{t("table.completed")}</TableHead>
                <TableHead className="w-[120px] text-right font-semibold">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((tr) => (
                <TableRow key={tr.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-medium">
                      {tr.transferNumber}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{tr.fromWarehouse.code}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{tr.toWarehouse.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {tr.items.length} {t("table.items_label")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(tr.status)}>
                      {t(`status.${tr.status}` as any)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tr.createdAt, {
                      locale: params.locale,
                      dateStyle: "medium",
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tr.completedAt
                      ? formatDate(tr.completedAt, {
                          locale: params.locale,
                          dateStyle: "medium",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <StockTransferActions transfer={tr} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
