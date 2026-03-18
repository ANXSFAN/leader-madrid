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
import { getCustomsDeclarations } from "@/lib/actions/customs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { PageHeader } from "@/components/admin/page-header";
import { CustomsStatusBadge } from "@/components/admin/customs-status-badge";
import { Input } from "@/components/ui/input";

interface CustomsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    search?: string;
  }>;
}

const STATUSES = ["ALL", "DRAFT", "SUBMITTED", "INSPECTING", "CLEARED", "HELD", "RELEASED"] as const;
const TYPES = ["ALL", "IMPORT", "EXPORT"] as const;

export default async function CustomsPage({ searchParams }: CustomsPageProps) {
  const params = await searchParams;
  const [locale, settings, t, declarations] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.customs"),
    getCustomsDeclarations({
      status: params.status,
      type: params.type,
      search: params.search,
    }),
  ]);
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            <Link href="/admin/customs/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.create")}
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3" method="GET">
        <Input
          name="search"
          placeholder={t("filter.search_placeholder")}
          defaultValue={params.search || ""}
          className="w-64"
        />
        <select
          name="status"
          defaultValue={params.status || "ALL"}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? t("filter.all_statuses") : t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={params.type || "ALL"}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp === "ALL" ? t("filter.all_types") : t(`type.${tp}`)}
            </option>
          ))}
        </select>
      </form>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.declaration_number")}</TableHead>
              <TableHead>{t("table.type")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.po_number")} / {t("table.so_number")}</TableHead>
              <TableHead>{t("table.declared_value")}</TableHead>
              <TableHead>{t("table.destination")}</TableHead>
              <TableHead>{t("form.shipping_method")}</TableHead>
              <TableHead>{t("table.created_at")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {declarations.map((decl) => (
              <TableRow key={decl.id}>
                <TableCell className="font-medium">{decl.declarationNumber}</TableCell>
                <TableCell>
                  <Badge variant={decl.type === "IMPORT" ? "secondary" : "outline"}>
                    {t(`type.${decl.type}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <CustomsStatusBadge
                    status={decl.status}
                    label={t(`status.${decl.status}`)}
                  />
                </TableCell>
                <TableCell>
                  {decl.purchaseOrder?.poNumber || decl.salesOrder?.orderNumber || "—"}
                </TableCell>
                <TableCell>
                  {formatMoney(decl.declaredValue, { locale, currency: decl.currency || currency })}
                </TableCell>
                <TableCell>
                  {decl.countryOfOrigin && decl.destinationCountry
                    ? `${decl.countryOfOrigin} → ${decl.destinationCountry}`
                    : decl.countryOfOrigin || decl.destinationCountry || "—"}
                </TableCell>
                <TableCell>
                  {decl.shippingMethod ? t(`shipping_method.${decl.shippingMethod}`) : "—"}
                </TableCell>
                <TableCell>{format(decl.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/customs/${decl.id}`}>
                      {t("table.view")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {declarations.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  {t("table.no_declarations")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
