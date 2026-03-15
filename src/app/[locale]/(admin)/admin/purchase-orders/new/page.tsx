import db from "@/lib/db";
import { PurchaseOrderForm } from "@/components/admin/purchase-order-form";
import { getLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { getActiveWarehouses } from "@/lib/actions/warehouse";

export default async function NewPurchaseOrderPage() {
  const [suppliers, products, locale, siteSettings, warehouses] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.product.findMany({
      include: {
        variants: true,
      },
      orderBy: { slug: "asc" },
    }),
    getLocale(),
    getSiteSettings(),
    getActiveWarehouses(),
  ]);

  const currency = siteSettings.currency || "EUR";

  // Serialize Decimal fields to plain numbers for client component
  const serializedProducts = products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : null,
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      costPrice: v.costPrice ? Number(v.costPrice) : null,
    })),
  }));

  return (
    <div className="flex-1 space-y-4">
      <PurchaseOrderForm suppliers={suppliers} products={serializedProducts} warehouses={warehouses} locale={locale} currency={currency} />
    </div>
  );
}
