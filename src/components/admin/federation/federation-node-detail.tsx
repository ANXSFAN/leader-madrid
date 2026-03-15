"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateFederationNode,
  updateFederationNodeStatus,
  deleteFederationNode,
  regenerateNodeKeys,
  regenerateInboundKey,
} from "@/lib/actions/federation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Key,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  XCircle,
  FileText,
  Copy,
} from "lucide-react";

interface Props {
  node: {
    id: string;
    name: string;
    code: string;
    type: "UPSTREAM" | "DOWNSTREAM";
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    inboundKey: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED";
    lastSyncAt: Date | null;
    lastError: string | null;
    defaultCurrency: string;
    paymentTermsDays: number;
    creditLimit: any;
    supplierId: string | null;
    supplier: { id: string; name: string; code: string } | null;
    channels: { id: string; name: string; _count: { products: number } }[];
    _count: { orders: number; syncLogs: number; settlements: number };
    createdAt: Date;
  };
  suppliers: { id: string; name: string; code: string }[];
}

const statusVariant: Record<string, string> = {
  ACTIVE: "status-active",
  PENDING: "status-pending",
  SUSPENDED: "status-inactive",
  REVOKED: "status-cancelled",
};

export function FederationNodeDetail({ node, suppliers }: Props) {
  const t = useTranslations("admin.federation");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleStatusChange = async (status: "ACTIVE" | "SUSPENDED" | "REVOKED") => {
    if (status === "REVOKED" && !confirm(t("confirm_revoke"))) return;
    setLoading(true);
    try {
      await updateFederationNodeStatus(node.id, status);
      toast.success(t("status_updated"));
      router.refresh();
    } catch (error) {
      toast.error(`${t("error")}: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("confirm_delete"))) return;
    try {
      await deleteFederationNode(node.id);
      toast.success(t("node_deleted"));
      router.push("/admin/federation");
    } catch (error) {
      toast.error(`${t("error")}: ${String(error)}`);
    }
  };

  const handleRegenerateKeys = async () => {
    if (!confirm(t("confirm_regenerate_keys"))) return;
    try {
      const result = await regenerateNodeKeys(node.id);
      toast.success(t("keys_regenerated"));
      router.refresh();
    } catch (error) {
      toast.error(`${t("error")}: ${String(error)}`);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateFederationNode(node.id, {
        name: formData.get("name") as string,
        baseUrl: formData.get("baseUrl") as string,
        defaultCurrency: formData.get("defaultCurrency") as string,
        paymentTermsDays: parseInt(formData.get("paymentTermsDays") as string) || 30,
        creditLimit: formData.get("creditLimit")
          ? parseFloat(formData.get("creditLimit") as string)
          : null,
        supplierId: (formData.get("supplierId") as string) === "__none__" ? null : (formData.get("supplierId") as string) || null,
      });
      toast.success(t("node_updated"));
      router.refresh();
    } catch (error) {
      toast.error(`${t("error")}: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status & Actions Bar */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Badge variant={statusVariant[node.status] as any} className="text-sm px-3 py-1">
              {t(`status_${node.status.toLowerCase()}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t(node.type === "UPSTREAM" ? "type_upstream" : "type_downstream")}
            </span>
            {node.lastError && (
              <span className="text-sm text-destructive">{node.lastError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {node.status === "PENDING" && (
              <Button size="sm" onClick={() => handleStatusChange("ACTIVE")} disabled={loading}>
                <Play className="mr-1 h-3 w-3" />
                {t("activate")}
              </Button>
            )}
            {node.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("SUSPENDED")} disabled={loading}>
                <Pause className="mr-1 h-3 w-3" />
                {t("suspend")}
              </Button>
            )}
            {node.status === "SUSPENDED" && (
              <Button size="sm" onClick={() => handleStatusChange("ACTIVE")} disabled={loading}>
                <Play className="mr-1 h-3 w-3" />
                {t("reactivate")}
              </Button>
            )}
            {node.status !== "REVOKED" && (
              <Button size="sm" variant="destructive" onClick={() => handleStatusChange("REVOKED")} disabled={loading}>
                <XCircle className="mr-1 h-3 w-3" />
                {t("revoke")}
              </Button>
            )}
            <Link href={`/admin/federation/${node.id}/logs`}>
              <Button size="sm" variant="outline">
                <FileText className="mr-1 h-3 w-3" />
                {t("sync_logs")} ({node._count.syncLogs})
              </Button>
            </Link>
            {(node.status === "PENDING" || node.status === "REVOKED") && (
              <Button size="sm" variant="ghost" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit Form */}
        <form onSubmit={handleUpdate}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="border-l-4 border-yellow-500 pl-3">
                {t("basic_info")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("node_name")}</Label>
                <Input id="name" name="name" defaultValue={node.name} />
              </div>
              <div className="space-y-2">
                <Label>{t("node_code")}</Label>
                <Input value={node.code} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">{t("base_url")}</Label>
                <Input id="baseUrl" name="baseUrl" defaultValue={node.baseUrl} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCurrency">{t("currency")}</Label>
                <Input id="defaultCurrency" name="defaultCurrency" defaultValue={node.defaultCurrency} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTermsDays">{t("payment_terms_days")}</Label>
                <Input id="paymentTermsDays" name="paymentTermsDays" type="number" defaultValue={node.paymentTermsDays} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">{t("credit_limit")}</Label>
                <Input id="creditLimit" name="creditLimit" type="number" step="0.01" defaultValue={node.creditLimit?.toString() || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierId">{t("link_supplier")}</Label>
                <Select name="supplierId" defaultValue={node.supplierId || "__none__"}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("no_supplier")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("no_supplier")}</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-black w-full">
                {t("save_changes")}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* API Keys */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="border-l-4 border-yellow-500 pl-3 flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t("api_keys")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("outbound_api_key")}</Label>
              <div className="flex gap-2">
                <Input value={`${node.apiKey.slice(0, 20)}...`} disabled className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(node.apiKey, "API Key")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("outbound_key_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("inbound_api_key")}</Label>
              <div className="flex gap-2">
                <Input value={`${node.inboundKey.slice(0, 20)}...`} disabled className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(node.inboundKey, "Inbound Key")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("inbound_key_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("api_secret")}</Label>
              <div className="flex gap-2">
                <Input value="••••••••••••••••••••" disabled className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(node.apiSecret, "API Secret")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRegenerateKeys} className="flex-1">
                <RefreshCw className="mr-1 h-3 w-3" />
                {t("regenerate_keys")}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">{t("stats")}</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold">{node.channels.length}</div>
                  <div className="text-xs text-muted-foreground">{t("channels")}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{node._count.orders}</div>
                  <div className="text-xs text-muted-foreground">{t("orders")}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{node._count.settlements}</div>
                  <div className="text-xs text-muted-foreground">{t("settlements")}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
