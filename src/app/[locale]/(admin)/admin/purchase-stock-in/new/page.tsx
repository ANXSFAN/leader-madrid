import { requireRole } from "@/lib/auth-guard";
import db from "@/lib/db";
import { PurchaseStockInForm } from "@/components/admin/purchase-stock-in-form";
import { getTranslations } from "next-intl/server";

export default async function NewPurchaseStockInPage() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  const t = await getTranslations("admin.purchaseStockIn");

  const [suppliers, warehouses] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.warehouse.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isDefault: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("new_title")}</h1>
        <p className="text-muted-foreground">{t("new_subtitle")}</p>
      </div>
      <PurchaseStockInForm suppliers={suppliers} warehouses={warehouses} />
    </div>
  );
}
