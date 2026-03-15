"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { Eye } from "lucide-react";

interface FederationNodeRow {
  id: string;
  name: string;
  code: string;
  type: string;
  baseUrl: string;
  status: string;
  defaultCurrency: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
  _count: {
    channels: number;
    orders: number;
    syncLogs: number;
  };
}

const STATUS_VARIANT: Record<string, "status-active" | "status-pending" | "status-inactive" | "status-cancelled"> = {
  ACTIVE: "status-active",
  PENDING: "status-pending",
  SUSPENDED: "status-inactive",
  REVOKED: "status-cancelled",
};

interface FederationNodeTableProps {
  nodes: FederationNodeRow[];
}

export function FederationNodeTable({ nodes }: FederationNodeTableProps) {
  const t = useTranslations("admin.federation");

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">{t("table.name")}</TableHead>
            <TableHead className="font-semibold">{t("table.code")}</TableHead>
            <TableHead className="font-semibold">{t("table.type")}</TableHead>
            <TableHead className="font-semibold">{t("table.status")}</TableHead>
            <TableHead className="font-semibold">{t("table.supplier")}</TableHead>
            <TableHead className="font-semibold text-right">{t("table.channels")}</TableHead>
            <TableHead className="font-semibold text-right">{t("table.orders")}</TableHead>
            <TableHead className="font-semibold">{t("table.last_sync")}</TableHead>
            <TableHead className="w-[80px]">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center py-8 text-muted-foreground"
              >
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            nodes.map((node) => (
              <TableRow key={node.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{node.name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                    {node.code}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant={node.type === "UPSTREAM" ? "default" : "secondary"}>
                    {t(`type.${node.type.toLowerCase()}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[node.status] || "status-inactive"}>
                    {t(`status.${node.status.toLowerCase()}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {node.supplier ? node.supplier.name : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {node._count.channels}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {node._count.orders}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {node.lastSyncAt
                    ? new Date(node.lastSyncAt).toLocaleString()
                    : t("never")}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/federation/${node.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
