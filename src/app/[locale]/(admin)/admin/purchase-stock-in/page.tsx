import { requireRole } from "@/lib/auth-guard";
import { getQuickStockInRecords } from "@/lib/actions/purchase-stock-in";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default async function PurchaseStockInPage() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const t = await getTranslations("admin.purchaseStockIn");
  const { items, total } = await getQuickStockInRecords();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/admin/purchase-stock-in/new">
          <Button className="bg-slate-900 text-white hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" /> {t("new_button")}
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.po_number")}</TableHead>
              <TableHead>{t("table.supplier")}</TableHead>
              <TableHead>{t("table.warehouse")}</TableHead>
              <TableHead>{t("table.items_count")}</TableHead>
              <TableHead className="text-right">{t("table.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((po) => (
              <TableRow key={po.id}>
                <TableCell>
                  {new Date(po.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <Link
                    href={`/admin/purchase-stock-in/${po.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>{po.warehouse?.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{po.items.length}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Number(po.totalAmount).toFixed(2)} {po.currency}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 20 && (
        <p className="text-sm text-muted-foreground text-center">
          {t("showing", { count: items.length, total })}
        </p>
      )}
    </div>
  );
}
