import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApprovalRequests } from "@/lib/actions/approval";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ApprovalActions } from "@/components/admin/approval-actions";
import { Link } from "@/i18n/navigation";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

const ENTITY_TYPE_LINK: Record<string, string> = {
  PURCHASE_ORDER: "/admin/purchase-orders",
  DELIVERY_ORDER: "/admin/delivery-orders",
  STOCK_ADJUSTMENT: "/admin/inventory",
};

export default async function ApprovalsPage() {
  const [t, approvals] = await Promise.all([
    getTranslations("admin.approvals"),
    getApprovalRequests(),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader title={t("title")} />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.entity_type")}</TableHead>
              <TableHead>{t("table.entity_id")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.reason")}</TableHead>
              <TableHead>{t("table.requested_by")}</TableHead>
              <TableHead>{t("table.requested_at")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.map((a) => {
              const basePath = ENTITY_TYPE_LINK[a.entityType];
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {a.entityType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {basePath ? (
                      <Link href={`${basePath}/${a.entityId}`} className="text-blue-600 hover:underline">
                        {a.entityId.slice(0, 8)}...
                      </Link>
                    ) : (
                      <>{a.entityId.slice(0, 8)}...</>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status] || "outline"}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {a.reason || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.requestedBy.slice(0, 8)}...</TableCell>
                  <TableCell>{format(a.requestedAt, "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <ApprovalActions approvalId={a.id} status={a.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {approvals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
