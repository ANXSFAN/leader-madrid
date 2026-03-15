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
import { getLots } from "@/lib/actions/inventory-lot";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";

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

export default async function InventoryLotsPage() {
  const [t, lots] = await Promise.all([
    getTranslations("admin.inventoryLots"),
    getLots(),
  ]);

  const now = new Date();

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
            <Link href="/admin/inventory-lots/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.create")}
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.lot_number")}</TableHead>
              <TableHead>{t("table.sku")}</TableHead>
              <TableHead>{t("table.product")}</TableHead>
              <TableHead className="text-right">{t("table.quantity")}</TableHead>
              <TableHead className="text-right">{t("table.initial_qty")}</TableHead>
              <TableHead>{t("table.bin_location")}</TableHead>
              <TableHead>{t("table.expiry_date")}</TableHead>
              <TableHead>{t("table.reference")}</TableHead>
              <TableHead>{t("table.created_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((lot) => {
              const isExpiring = lot.expiryDate && new Date(lot.expiryDate) <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
              const isExpired = lot.expiryDate && new Date(lot.expiryDate) <= now;

              return (
                <TableRow key={lot.id}>
                  <TableCell className="font-mono text-sm font-medium">{lot.lotNumber}</TableCell>
                  <TableCell className="font-mono text-sm">{lot.variant.sku}</TableCell>
                  <TableCell>{resolveProductName(lot.variant.product.content)}</TableCell>
                  <TableCell className="text-right">{lot.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{lot.initialQuantity}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {(lot as Record<string, unknown>).binLocation
                      ? ((lot as Record<string, unknown>).binLocation as { code: string }).code
                      : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {lot.expiryDate ? (
                      <span className={isExpired ? "text-red-600 font-medium" : isExpiring ? "text-yellow-600" : ""}>
                        {format(new Date(lot.expiryDate), "yyyy-MM-dd")}
                        {isExpired && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            {t("table.expired")}
                          </Badge>
                        )}
                        {!isExpired && isExpiring && (
                          <Badge variant="outline" className="ml-2 text-xs text-yellow-600 border-yellow-300">
                            {t("table.expiring_soon")}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lot.reference || "-"}</TableCell>
                  <TableCell>{format(lot.createdAt, "yyyy-MM-dd")}</TableCell>
                </TableRow>
              );
            })}
            {lots.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  {t("table.no_lots")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
