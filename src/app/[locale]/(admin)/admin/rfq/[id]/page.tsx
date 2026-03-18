import { getRFQDetail, updateRFQStatus } from "@/lib/actions/rfq";
import { notFound } from "next/navigation";
import { RFQStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import RFQStatusForm from "./status-form";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";

export default async function RFQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [rfq, locale, settings, t] = await Promise.all([
    getRFQDetail(id),
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.adminRfq"),
  ]);
  if (!rfq) notFound();
  const currency = settings.currency;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/rfq" className="text-xs text-muted-foreground hover:underline mb-1 block">
            {t("detail.back_to_list")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t("detail.title", { id: rfq.id.slice(0, 8) })}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("detail.received", { date: new Date(rfq.createdAt).toLocaleString(locale) })}
          </p>
        </div>
        <RFQStatusForm rfqId={rfq.id} currentStatus={rfq.status} currentNote={rfq.adminNote} currentTotal={rfq.quotedTotal ? Number(rfq.quotedTotal) : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            {t("detail.contact_details")}
          </h2>
          <dl className="space-y-2">
            {[
              [t("detail.field_name"), rfq.contactName],
              [t("detail.field_email"), rfq.contactEmail],
              [t("detail.field_company"), rfq.companyName],
              [t("detail.field_phone"), rfq.phone],
              [t("detail.field_country"), rfq.country],
              [t("detail.field_registered_user"), rfq.user?.email || t("detail.guest")],
            ].map(([label, value]) =>
              value ? (
                <div key={String(label)} className="flex gap-3">
                  <dt className="w-28 text-xs font-semibold text-muted-foreground shrink-0">{label}</dt>
                  <dd className="text-sm text-foreground">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            {t("detail.status_and_quote")}
          </h2>
          <dl className="space-y-2">
            <div className="flex gap-3">
              <dt className="w-28 text-xs font-semibold text-muted-foreground">{t("table.status")}</dt>
              <dd>
                <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", getStatusClass(rfq.status))}>
                  {t(`status.${rfq.status}`)}
                </span>
              </dd>
            </div>
            {rfq.quotedTotal && (
              <div className="flex gap-3">
                <dt className="w-28 text-xs font-semibold text-muted-foreground">{t("detail.quoted_total")}</dt>
                <dd className="text-sm font-bold text-foreground">
                  {new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(rfq.quotedTotal))}
                </dd>
              </div>
            )}
            {rfq.adminNote && (
              <div className="flex gap-3">
                <dt className="w-28 text-xs font-semibold text-muted-foreground">{t("detail.admin_note")}</dt>
                <dd className="text-sm text-muted-foreground">{rfq.adminNote}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t("detail.requested_products", { count: rfq.items.length })}
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-secondary">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("detail.col_product")}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("detail.col_sku")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("detail.col_qty")}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("detail.col_target_price")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {rfq.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-medium text-foreground">{item.productName}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.variantSku || "—"}</td>
                <td className="px-4 py-3 text-sm text-right font-bold">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {item.targetPrice
                    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(item.targetPrice))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rfq.message && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">{t("detail.message")}</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rfq.message}</p>
        </div>
      )}
    </div>
  );
}

function getStatusClass(status: RFQStatus) {
  const map: Record<RFQStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    REVIEWING: "bg-blue-100 text-blue-800",
    QUOTED: "bg-purple-100 text-purple-800",
    ACCEPTED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    EXPIRED: "bg-muted text-muted-foreground",
  };
  return map[status] || "bg-muted text-muted-foreground";
}
