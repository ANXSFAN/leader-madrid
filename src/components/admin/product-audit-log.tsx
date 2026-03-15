import { getAuditLogs } from "@/lib/audit";
import { getTranslations } from "next-intl/server";
import { PlusCircle, Pencil, Trash2, ToggleRight } from "lucide-react";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <PlusCircle className="h-4 w-4 text-green-500" />,
  UPDATE: <Pencil className="h-4 w-4 text-blue-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  STATUS_CHANGE: <ToggleRight className="h-4 w-4 text-amber-500" />,
};

interface ProductAuditLogProps {
  productId: string;
}

export async function ProductAuditLog({ productId }: ProductAuditLogProps) {
  const t = await getTranslations("admin.products.audit");
  const logs = await getAuditLogs("PRODUCT", productId);

  if (logs.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-4">
        {t("no_logs")}
      </div>
    );
  }

  const actionLabel = (action: string) => {
    switch (action) {
      case "CREATE": return t("create");
      case "UPDATE": return t("update");
      case "DELETE": return t("delete");
      case "STATUS_CHANGE": return t("status_change");
      default: return action;
    }
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-3">{t("title")}</h3>
      <div className="relative border-l-2 border-slate-200 ml-2 space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="relative pl-6">
            {/* Timeline dot */}
            <div className="absolute -left-[9px] top-1 bg-white">
              {ACTION_ICONS[log.action] || <div className="h-4 w-4 rounded-full bg-slate-300" />}
            </div>

            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{actionLabel(log.action)}</span>
                <span className="text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.userName && (
                <div className="text-xs text-slate-500">{log.userName}</div>
              )}
              {log.changes && typeof log.changes === "object" && (
                <div className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 space-y-0.5">
                  {Object.entries(log.changes as Record<string, { old: unknown; new: unknown }>).map(
                    ([field, { old: oldVal, new: newVal }]) => (
                      <div key={field}>
                        <span className="font-mono">{field}</span>:{" "}
                        <span className="text-red-400 line-through">{String(oldVal ?? "—")}</span>
                        {" → "}
                        <span className="text-green-600">{String(newVal ?? "—")}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
