import { getWarehouse, getWarehouseStock } from "@/lib/actions/warehouse";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { WarehouseForm } from "@/components/admin/warehouse-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getLocalized } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function WarehouseDetailPage(
  props: { params: Promise<{ locale: string; id: string }> }
) {
  const params = await props.params;
  const t = await getTranslations("admin.warehouses");
  const isNew = params.id === "new";

  let warehouse = null;
  let stockEntries: any[] = [];

  if (!isNew) {
    warehouse = await getWarehouse(params.id);
    if (!warehouse) return notFound();
    stockEntries = await getWarehouseStock(params.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? t("actions.new") : warehouse!.name}
        description={isNew ? t("new_subtitle") : `${t("code_label")}: ${warehouse!.code}`}
        breadcrumbs={[
          { label: t("title"), href: "/admin/warehouses" },
          { label: isNew ? t("actions.new") : warehouse!.name },
        ]}
      />

      <WarehouseForm warehouse={warehouse ?? undefined} />

      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="border-l-4 border-yellow-500 pl-3">
              {t("stock_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("no_stock")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t("stock_table.product")}</TableHead>
                    <TableHead className="font-semibold">{t("stock_table.sku")}</TableHead>
                    <TableHead className="font-semibold text-right">{t("stock_table.physical")}</TableHead>
                    <TableHead className="font-semibold text-right">{t("stock_table.allocated")}</TableHead>
                    <TableHead className="font-semibold text-right">{t("stock_table.available")}</TableHead>
                    <TableHead className="font-semibold text-right">{t("stock_table.min_stock")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockEntries.map((entry: any) => {
                    const available = entry.physicalStock - entry.allocatedStock;
                    const isLow = available > 0 && available <= entry.minStock;
                    const isOut = available <= 0;
                    const productName = getLocalized(entry.variant.product.content, params.locale).name;

                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{productName}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                            {entry.variant.sku}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">{entry.physicalStock}</TableCell>
                        <TableCell className="text-right font-mono">{entry.allocatedStock}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={isOut ? "destructive" : isLow ? "secondary" : "default"}
                            className={
                              isOut ? "" :
                              isLow ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700 hover:bg-green-100"
                            }
                          >
                            {available}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {entry.minStock}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
