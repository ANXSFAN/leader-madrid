import { getShippingMethods } from "@/lib/actions/shipping";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Truck, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteShippingMethodDialog } from "./delete-dialog";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const methods = await getShippingMethods();
  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.shippingMethods"),
  ]);
  const currency = settings.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/shipping/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.new")}
            </Link>
          </Button>
        }
      />

      {methods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-3">{t("empty_icon_text")}</p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
              <Link href="/admin/shipping/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("empty_action")}
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
                <TableHead className="font-semibold">{t("table.price")}</TableHead>
                <TableHead className="font-semibold">{t("table.estimated_days")}</TableHead>
                <TableHead className="font-semibold">{t("table.status")}</TableHead>
                <TableHead className="font-semibold">{t("table.default")}</TableHead>
                <TableHead className="w-[100px] text-right font-semibold">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{method.name}</p>
                        {method.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {method.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-medium">
                      {formatMoney(method.price, { locale, currency })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {method.estimatedDays ? t("days_suffix", { count: method.estimatedDays }) : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={method.isActive ? "default" : "secondary"}
                      className={method.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                    >
                      {method.isActive ? t("fields.active") : t("fields.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {method.isDefault && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {t("fields.default")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/admin/shipping/${method.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteShippingMethodDialog method={method} />
                    </div>
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
