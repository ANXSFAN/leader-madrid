import { getRFQList } from "@/lib/actions/rfq";
import { Link } from "@/i18n/navigation";
import { RFQStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight } from "lucide-react";

const STATUS_CLASS: Record<RFQStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  REVIEWING: "bg-blue-100 text-blue-800 border-blue-200",
  QUOTED: "bg-purple-100 text-purple-800 border-purple-200",
  ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
};

export default async function AdminRFQPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: RFQStatus; page?: string }>;
}) {
  const sp = await searchParams;
  const page = parseInt(sp.page || "1");
  const [{ requests, total, pages }, locale, t] = await Promise.all([
    getRFQList(page, sp.status),
    getLocale(),
    getTranslations("admin.adminRfq"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("total_desc", { total })}
      />

      <div className="flex gap-2 flex-wrap">
        {(["", "PENDING", "REVIEWING", "QUOTED", "ACCEPTED", "REJECTED"] as const).map((s) => (
          <Link
            key={s}
            href={s ? `/admin/rfq?status=${s}` : "/admin/rfq"}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              (sp.status === s || (!sp.status && s === ""))
                ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:shadow-sm"
            )}
          >
            {s ? t(`status.${s}`) : t("filter_all")}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.contact")}</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.products")}</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.status")}</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.date")}</th>
              <th className="px-5 py-3.5 w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">{t("table.empty")}</p>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((rfq) => {
                const statusClass = STATUS_CLASS[rfq.status];
                return (
                  <tr key={rfq.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4">
                      <p className="font-medium text-sm">{rfq.contactName}</p>
                      <p className="text-xs text-muted-foreground">{rfq.contactEmail}</p>
                      {rfq.companyName && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{rfq.companyName}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        {rfq.items.slice(0, 2).map((item, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {item.productName} <span className="text-muted-foreground/60">x{item.quantity}</span>
                          </span>
                        ))}
                        {rfq.items.length > 2 && (
                          <span className="text-xs text-muted-foreground/60">
                            {t("more_items", { count: rfq.items.length - 2 })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className={cn("text-xs font-medium border", statusClass)}>
                        {t(`status.${rfq.status}`)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(rfq.createdAt).toLocaleDateString(locale)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/rfq/${rfq.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        {t("table.view")}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <Link
              key={i}
              href={`/admin/rfq?page=${i + 1}${sp.status ? `&status=${sp.status}` : ""}`}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium border transition-all duration-200",
                page === i + 1
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:shadow-sm"
              )}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
