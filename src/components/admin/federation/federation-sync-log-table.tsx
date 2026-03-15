"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SyncLog {
  id: string;
  direction: string;
  entityType: string;
  entityId: string | null;
  action: string;
  status: string;
  errorMsg: string | null;
  createdAt: Date;
}

interface Props {
  logs: SyncLog[];
  total: number;
  page: number;
  totalPages: number;
  nodeId: string;
}

export function FederationSyncLogTable({ logs, total, page, totalPages, nodeId }: Props) {
  const t = useTranslations("admin.federation");

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase tracking-widest text-xs">{t("direction")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("entity_type")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("action_label")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("status_label")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("error")}</TableHead>
              <TableHead className="uppercase tracking-widest text-xs">{t("timestamp")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("no_logs")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-yellow-500/5">
                  <TableCell>
                    <Badge variant={log.direction === "INBOUND" ? "secondary" : "default"}>
                      {log.direction === "INBOUND" ? "IN" : "OUT"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{log.entityType}</code>
                  </TableCell>
                  <TableCell className="text-sm">{log.action}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "SUCCESS"
                          ? ("status-active" as any)
                          : log.status === "FAILED"
                            ? ("status-cancelled" as any)
                            : ("status-pending" as any)
                      }
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                    {log.errorMsg || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("showing_logs", { count: logs.length, total })}
          </p>
          <div className="flex gap-2">
            <Link href={`/admin/federation/${nodeId}/logs?page=${Math.max(1, page - 1)}`}>
              <Button variant="outline" size="sm" disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="flex items-center px-3 text-sm">
              {page} / {totalPages}
            </span>
            <Link href={`/admin/federation/${nodeId}/logs?page=${Math.min(totalPages, page + 1)}`}>
              <Button variant="outline" size="sm" disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
