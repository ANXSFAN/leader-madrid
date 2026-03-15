import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { LotForm } from "@/components/admin/lot-form";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";
import db from "@/lib/db";

export default async function NewLotPage() {
  const [t, warehouses, variants, binLocations] = await Promise.all([
    getTranslations("admin.inventoryLots"),
    getActiveWarehouses(),
    db.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        product: { select: { content: true, slug: true } },
      },
      orderBy: { sku: "asc" },
      take: 500,
    }),
    db.binLocation.findMany({
      where: { isActive: true },
      select: { id: true, code: true, zone: true, description: true, warehouseId: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("new_title")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/inventory-lots" },
          { label: t("new_title") },
        ]}
      />
      <LotForm warehouses={warehouses} variants={variants} binLocations={binLocations} />
    </div>
  );
}
