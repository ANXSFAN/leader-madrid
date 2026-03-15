import { getWarehouses } from "@/lib/actions/warehouse";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Warehouse as WarehouseIcon, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const [warehouses, t] = await Promise.all([
    getWarehouses(),
    getTranslations("admin.warehouses"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
            <Link href="/admin/warehouses/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.new")}
            </Link>
          </Button>
        }
      />

      {warehouses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <WarehouseIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-3">{t("empty")}</p>
            <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
              <Link href="/admin/warehouses/new">
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
                <TableHead className="font-semibold">{t("table.name")}</TableHead>
                <TableHead className="font-semibold">{t("table.code")}</TableHead>
                <TableHead className="font-semibold">{t("table.location")}</TableHead>
                <TableHead className="font-semibold">{t("table.stock_entries")}</TableHead>
                <TableHead className="font-semibold">{t("table.status")}</TableHead>
                <TableHead className="font-semibold">{t("table.default")}</TableHead>
                <TableHead className="w-[100px] text-right font-semibold">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((wh) => (
                <TableRow key={wh.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
                        <WarehouseIcon className="h-4 w-4" />
                      </div>
                      <span>{wh.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{wh.code}</code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[wh.city, wh.country].filter(Boolean).join(", ") || "-"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{wh._count.stockEntries}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={wh.isActive ? "default" : "secondary"}
                      className={wh.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                    >
                      {wh.isActive ? t("status.active") : t("status.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {wh.isDefault && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {t("default_label")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/admin/warehouses/${wh.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
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
