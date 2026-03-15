import { requireRole } from "@/lib/auth-guard";
import db from "@/lib/db";
import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GlobalStockAdjustmentDialog } from "@/components/admin/global-stock-adjustment-dialog";

export default async function StockAdjustmentsPage() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const t = await getTranslations("admin.stockAdjustments");

  const warehouses = await db.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, isDefault: true },
  });

  const transactions = await db.inventoryTransaction.findMany({
    where: {
      type: { in: ["ADJUSTMENT", "DAMAGED"] },
    },
    include: {
      variant: {
        select: {
          sku: true,
          product: { select: { content: true, slug: true } },
        },
      },
      warehouse: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <GlobalStockAdjustmentDialog warehouses={warehouses} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead>{t("table.sku")}</TableHead>
              <TableHead>{t("table.type")}</TableHead>
              <TableHead>{t("table.quantity")}</TableHead>
              <TableHead>{t("table.warehouse")}</TableHead>
              <TableHead>{t("table.reference")}</TableHead>
              <TableHead>{t("table.note")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const content = tx.variant.product.content as Record<string, { name?: string }> | null;
              const productName =
                content?.en?.name || content?.es?.name || content?.zh?.name || tx.variant.product.slug;

              const isPositive = tx.quantity > 0;
              let typeLabel: string;
              if (tx.type === "DAMAGED") {
                typeLabel = t("type.damaged");
              } else if (isPositive) {
                typeLabel = t("type.adjustment_in");
              } else {
                typeLabel = t("type.adjustment_out");
              }

              return (
                <TableRow key={tx.id}>
                  <TableCell>
                    {new Date(tx.createdAt).toLocaleDateString()}{" "}
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{productName}</TableCell>
                  <TableCell className="font-mono text-sm">{tx.variant.sku}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === "DAMAGED" ? "destructive" : isPositive ? "default" : "secondary"}>
                      {typeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-mono ${isPositive ? "text-green-600" : "text-red-600"}`}>
                    {isPositive ? "+" : ""}{tx.quantity}
                  </TableCell>
                  <TableCell>{tx.warehouse?.name || "-"}</TableCell>
                  <TableCell className="text-sm">{tx.reference || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.note || "-"}</TableCell>
                </TableRow>
              );
            })}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
