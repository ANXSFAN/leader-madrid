import { notFound } from "next/navigation";
import { getPurchaseReturn } from "@/lib/actions/purchase-return";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { PurchaseReturnActions } from "@/components/admin/purchase-return-actions";
import { getTranslations, getLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { format } from "date-fns";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  DRAFT: "outline",
  CONFIRMED: "secondary",
  SHIPPED_TO_SUPPLIER: "secondary",
  RECEIVED_BY_SUPPLIER: "default",
  REFUNDED: "default",
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

export default async function PurchaseReturnDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [t, locale, settings, pr] = await Promise.all([
    getTranslations("admin.purchaseReturns"),
    getLocale(),
    getSiteSettings(),
    getPurchaseReturn(params.id),
  ]);

  if (!pr) notFound();
  const currency = settings.currency;

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={pr.returnNumber}
        breadcrumbs={[
          { label: t("title"), href: "/admin/purchase-returns" },
          { label: pr.returnNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[pr.status] || "outline"} className="text-sm">
              {pr.status.replace(/_/g, " ")}
            </Badge>
            <PurchaseReturnActions
              purchaseReturnId={pr.id}
              status={pr.status}
            />
          </div>
        }
      />

      {/* Summary info */}
      <div className="rounded-md border bg-white p-4 text-sm space-y-1 text-muted-foreground">
        <p>
          <strong>{t("detail.po")}:</strong>{" "}
          <Link href={`/admin/purchase-orders/${pr.purchaseOrderId}`} className="text-blue-600 hover:underline">
            {pr.purchaseOrder.poNumber}
          </Link>
        </p>
        <p><strong>{t("detail.supplier")}:</strong> {pr.supplier.name} ({pr.supplier.code})</p>
        <p><strong>{t("detail.warehouse")}:</strong> {pr.warehouse.name} ({pr.warehouse.code})</p>
        <p><strong>{t("detail.total_amount")}:</strong> {formatMoney(pr.totalAmount, { locale, currency })}</p>
        <p><strong>{t("detail.created_at")}:</strong> {format(pr.createdAt, "yyyy-MM-dd")}</p>
        {pr.reason && <p><strong>{t("detail.reason")}:</strong> {pr.reason}</p>}
      </div>

      {/* Items table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.sku")}</TableHead>
              <TableHead>{t("detail.product")}</TableHead>
              <TableHead className="text-right">{t("detail.quantity")}</TableHead>
              <TableHead className="text-right">{t("detail.cost_price")}</TableHead>
              <TableHead className="text-right">{t("detail.total")}</TableHead>
              <TableHead>{t("detail.reason")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pr.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.sku || item.variant.sku}</TableCell>
                <TableCell>{item.name || resolveProductName(item.variant.product.content)}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{formatMoney(item.costPrice, { locale, currency })}</TableCell>
                <TableCell className="text-right">{formatMoney(item.total, { locale, currency })}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.reason || ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
