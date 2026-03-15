import { requireRole } from "@/lib/auth-guard";
import db from "@/lib/db";
import { AdminReturnForm } from "@/components/admin/admin-return-form";
import { getTranslations } from "next-intl/server";

export default async function NewAdminReturnPage() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const t = await getTranslations("admin.returns.adminCreate");

  const warehouses = await db.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, isDefault: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminReturnForm warehouses={warehouses} />
    </div>
  );
}
