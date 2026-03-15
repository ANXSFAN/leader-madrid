import db from "@/lib/db";
import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { PurchaseReturnForm } from "@/components/admin/purchase-return-form";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations, getLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";

export default async function NewPurchaseReturnPage() {
  const [t, locale, settings, warehouses, purchaseOrders] = await Promise.all([
    getTranslations("admin.purchaseReturns"),
    getLocale(),
    getSiteSettings(),
    getActiveWarehouses(),
    db.purchaseOrder.findMany({
      where: { status: { in: ["RECEIVED", "PARTIAL_RECEIVED"] } },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                costPrice: true,
                product: { select: { content: true, slug: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currency = settings.currency || "EUR";

  // Serialize Decimal fields
  const serializedPOs = purchaseOrders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    warehouseId: po.warehouseId,
    supplier: po.supplier,
    items: po.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      receivedQty: item.receivedQty,
      costPrice: Number(item.costPrice),
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        costPrice: item.variant.costPrice ? Number(item.variant.costPrice) : null,
        product: item.variant.product,
      },
    })),
  }));

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={t("new_title")}
        breadcrumbs={[
          { label: t("title"), href: "/admin/purchase-returns" },
          { label: t("new_title") },
        ]}
      />
      <PurchaseReturnForm
        purchaseOrders={serializedPOs}
        warehouses={warehouses}
        locale={locale}
        currency={currency}
      />
    </div>
  );
}
