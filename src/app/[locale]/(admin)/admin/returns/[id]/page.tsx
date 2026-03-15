import { getReturnRequestById } from "@/lib/actions/returns";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ReturnActions } from "./return-actions";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/formatters";
import { getSiteSettings } from "@/lib/actions/config";
import { getItemProductName, getItemSku } from "@/lib/utils/product-snapshot";
import { serializeDecimal } from "@/lib/serialize";
import { getActiveWarehouses } from "@/lib/actions/warehouse";

export const dynamic = "force-dynamic";

export default async function ReturnDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const [ret, locale, settings, tStatus, tReason, t, warehouses] = await Promise.all([
    getReturnRequestById(params.id),
    getLocale(),
    getSiteSettings(),
    getTranslations("returns.status"),
    getTranslations("returns.reason"),
    getTranslations("admin.returns"),
    getActiveWarehouses(),
  ]);
  const currency = settings.currency;
  if (!ret) notFound();

  const orderTotal = Number(ret.order.total ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/returns"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{ret.returnNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(ret.createdAt).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Badge className="ml-2">{tStatus(ret.status as any)}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.customer_info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{ret.user.companyName || ret.user.name}</p>
            <p className="text-muted-foreground">{ret.user.email}</p>
            {ret.user.taxId && (
              <p className="text-muted-foreground">{t("detail.tax_id")} {ret.user.taxId}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.original_order")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium font-mono">{ret.order.orderNumber}</p>
            <p className="text-muted-foreground">
              {t("detail.total", { amount: orderTotal.toFixed(2) })}
            </p>
            <Link
              href={`/admin/orders/${ret.orderId}`}
              className="text-blue-600 text-xs hover:underline"
            >
              {t("detail.view_order")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.return_reason")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{tReason(ret.reason as any)}</p>
          {ret.notes && (
            <p className="text-muted-foreground bg-slate-50 p-3 rounded">{ret.notes}</p>
          )}
          {ret.adminNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">{t("detail.internal_notes")}</p>
              <p className="text-sm">{ret.adminNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.items_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">{t("detail.product_sku")}</th>
                <th className="text-center py-2 font-medium">{t("detail.qty")}</th>
                <th className="text-center py-2 font-medium">{t("detail.condition")}</th>
                <th className="text-right py-2 font-medium">{t("detail.restock")}</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((item) => {
                return (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">
                      <p className="font-medium">{getItemProductName(item, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getItemSku(item)}
                      </p>
                    </td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-center">
                      <span className="text-xs">{item.condition ?? "—"}</span>
                    </td>
                    <td className="py-3 text-right">
                      {item.restockQty > 0 ? (
                        <Badge variant="outline">+{item.restockQty}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {ret.refundAmount && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">
              <span className="font-medium text-green-700">{t("detail.refund_processed")}</span>{" "}
              {formatMoney(ret.refundAmount, { locale, currency })}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ReturnActions
            returnId={ret.id}
            status={ret.status}
            items={serializeDecimal(ret.items.map((i) => ({
              id: i.id,
              quantity: i.quantity,
              restockQty: i.restockQty,
            })))}
            orderTotal={orderTotal}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
