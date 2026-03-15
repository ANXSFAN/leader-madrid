import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAuditLogs } from "@/lib/actions/audit-log";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface AuditLogPageProps {
  searchParams: Promise<{
    page?: string;
    entityType?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

const ENTITY_TYPES = [
  "PRODUCT",
  "ORDER",
  "SALES_ORDER",
  "USER",
  "CATEGORY",
  "SUPPLIER",
  "PURCHASE_ORDER",
  "INVENTORY",
  "WAREHOUSE",
  "PRICE_LIST",
  "INVOICE",
  "SHIPPING",
  "RFQ",
  "RETURN",
] as const;

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"] as const;

function getActionBadgeVariant(action: string) {
  switch (action) {
    case "CREATE":
      return "default";
    case "UPDATE":
      return "secondary";
    case "DELETE":
      return "destructive";
    case "STATUS_CHANGE":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams;
  const t = await getTranslations("admin.auditLog");

  const page = parseInt(params.page || "1", 10);
  const entityType = params.entityType && params.entityType !== "ALL" ? params.entityType : undefined;
  const action = params.action && params.action !== "ALL" ? params.action : undefined;

  const { logs, total, pageSize } = await getAuditLogs({
    page,
    pageSize: 25,
    entityType,
    action,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const totalPages = Math.ceil(total / (pageSize || 25));

  // Build base search params for pagination links
  const buildUrl = (newPage: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(newPage));
    if (params.entityType) sp.set("entityType", params.entityType);
    if (params.action) sp.set("action", params.action);
    if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
    if (params.dateTo) sp.set("dateTo", params.dateTo);
    return `/admin/audit-log?${sp.toString()}`;
  };

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("filter_entity_type")}
              </label>
              <select
                name="entityType"
                defaultValue={params.entityType || "ALL"}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-44"
              >
                <option value="ALL">{t("all_types")}</option>
                {ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("filter_action")}
              </label>
              <select
                name="action"
                defaultValue={params.action || "ALL"}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-40"
              >
                <option value="ALL">{t("all_actions")}</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("filter_date_from")}
              </label>
              <input
                type="date"
                name="dateFrom"
                defaultValue={params.dateFrom || ""}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("filter_date_to")}
              </label>
              <input
                type="date"
                name="dateTo"
                defaultValue={params.dateTo || ""}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <Button type="submit" size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold">
              {t("filter_apply")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_time")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_user")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_action")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_entity_type")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_entity_id")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("col_details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {t("no_logs")}
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id} className="hover:bg-yellow-50/50">
                <TableCell className="whitespace-nowrap">
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{log.userName || log.userId || "System"}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(log.action) as "default" | "secondary" | "destructive" | "outline"}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{log.entityType}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground" title={log.entityId}>
                    {log.entityId.length > 12
                      ? log.entityId.slice(0, 12) + "..."
                      : log.entityId}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs">
                  {log.changes ? (
                    <details className="cursor-pointer">
                      <summary className="text-xs text-blue-600 hover:underline">
                        {t("col_details")}
                      </summary>
                      <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">
            {t("page_info", { page, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(page - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("prev")}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("prev")}
              </Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(page + 1)}>
                  {t("next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t("next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
