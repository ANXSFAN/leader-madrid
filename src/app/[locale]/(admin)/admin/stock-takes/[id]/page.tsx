import { notFound } from "next/navigation";
import { getStockTake, getStockTakeReport } from "@/lib/actions/stock-take";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/stat-card";
import { StockTakeCountForm } from "@/components/admin/stock-take-count-form";
import { StockTakeActions } from "@/components/admin/stock-take-actions";
import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  DRAFT: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

interface ProductContentJson {
  [locale: string]: { name?: string } | string | undefined;
}

function resolveProductName(content: unknown): string {
  const c = content as ProductContentJson | null;
  if (!c) return "";
  for (const locale of ["en", "es", "de", "fr", "zh"]) {
    const localeData = c[locale];
    if (typeof localeData === "object" && localeData?.name) {
      return localeData.name;
    }
  }
  return "";
}

export default async function StockTakeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [t, stockTake, reportResult] = await Promise.all([
    getTranslations("admin.stockTakes"),
    getStockTake(params.id),
    getStockTakeReport(params.id),
  ]);

  if (!stockTake) notFound();

  const report = "error" in reportResult ? null : reportResult;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={`${stockTake.stockTakeNumber}`}
        breadcrumbs={[
          { label: t("title"), href: "/admin/stock-takes" },
          { label: stockTake.stockTakeNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[stockTake.status] || "outline"} className="text-sm">
              {stockTake.status}
            </Badge>
            <StockTakeActions
              stockTakeId={stockTake.id}
              status={stockTake.status}
            />
          </div>
        }
      />

      {/* Info */}
      <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground space-y-1">
        <p><strong>{t("detail.warehouse")}:</strong> {stockTake.warehouse.name} ({stockTake.warehouse.code})</p>
        {stockTake.note && <p><strong>{t("detail.note")}:</strong> {stockTake.note}</p>}
      </div>

      {/* Report Stats */}
      {report && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title={t("report.total_items")}
            value={report.totalItems}
            icon={ClipboardCheck}
            color="blue"
          />
          <StatCard
            title={t("report.counted")}
            value={`${report.countedItems} / ${report.totalItems}`}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title={t("report.discrepancies")}
            value={report.discrepancyItems}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title={t("report.net_difference")}
            value={report.netDifference >= 0 ? `+${report.netDifference}` : `${report.netDifference}`}
            icon={XCircle}
            color={report.netDifference === 0 ? "green" : "red"}
          />
        </div>
      )}

      {/* Count Form (IN_PROGRESS) or Read-only Table */}
      {stockTake.status === "IN_PROGRESS" ? (
        <StockTakeCountForm
          stockTakeId={stockTake.id}
          items={stockTake.items.map((item) => ({
            variantId: item.variantId,
            sku: item.variant.sku,
            productName: resolveProductName(item.variant.product.content),
            systemQty: item.systemQty,
            countedQty: item.countedQty,
            note: item.note,
          }))}
        />
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.sku")}</TableHead>
                <TableHead>{t("detail.product")}</TableHead>
                <TableHead className="text-right">{t("detail.system_qty")}</TableHead>
                <TableHead className="text-right">{t("detail.counted_qty")}</TableHead>
                <TableHead className="text-right">{t("detail.discrepancy")}</TableHead>
                <TableHead>{t("detail.note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockTake.items.map((item) => {
                const disc = item.discrepancy ?? 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.variant.sku}</TableCell>
                    <TableCell>{resolveProductName(item.variant.product.content)}</TableCell>
                    <TableCell className="text-right">{item.systemQty}</TableCell>
                    <TableCell className="text-right">
                      {item.countedQty !== null ? item.countedQty : "-"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      disc === 0 && item.countedQty !== null && "text-green-600",
                      disc < 0 && "text-red-600",
                      disc > 0 && "text-yellow-600",
                    )}>
                      {item.countedQty !== null ? (disc >= 0 ? `+${disc}` : disc) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.note || ""}</TableCell>
                  </TableRow>
                );
              })}
              {stockTake.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    {t("detail.no_items")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
