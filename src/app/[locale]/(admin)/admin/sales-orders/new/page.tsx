import { SalesOrderForm } from "@/components/admin/sales-order-form";
import db from "@/lib/db";
import { getCustomers } from "@/lib/actions/sales-order";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { getActiveWarehouses } from "@/lib/actions/warehouse";

async function getProducts() {
  const products = await db.product.findMany({
    where: { isActive: true },
    include: {
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return products;
}

export default async function NewSalesOrderPage() {
  const [customers, products, locale, settings, warehouses, t] = await Promise.all([
    getCustomers(),
    getProducts(),
    getLocale(),
    getSiteSettings(),
    getActiveWarehouses(),
    getTranslations("admin.salesOrders"),
  ]);
  const currency = settings.currency;

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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("form.title_create")}</h2>
      </div>
      <div className="h-full flex-1 flex-col space-y-8 md:flex">
        <SalesOrderForm customers={customers} products={serializedProducts} warehouses={warehouses} locale={locale} currency={currency} />
      </div>
    </div>
  );
}
