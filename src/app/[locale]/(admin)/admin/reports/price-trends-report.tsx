import { unstable_noStore as noStore } from "next/cache";
import db from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceTrendsInteractive } from "./price-trends-interactive";

export async function PriceTrendsReport() {
  noStore();

  const [locale, settings, t] = await Promise.all([
    getLocale(),
    getSiteSettings(),
    getTranslations("admin.reports"),
  ]);
  const currency = settings.currency;

  // Supplier price comparison table (always shown)
  const supplierPrices = await db.productSupplier.findMany({
    where: { costPrice: { not: null } },
    include: {
      supplier: { select: { name: true } },
      product: {
        select: {
          slug: true,
          content: true,
          variants: { select: { sku: true, costPrice: true }, take: 1 },
        },
      },
    },
    orderBy: { product: { slug: "asc" } },
  });

  // Group supplier prices by product
  const supplierCompareMap = new Map<
    string,
    { sku: string; name: string; currentCost: number | null; suppliers: { name: string; price: number }[] }
  >();

  for (const sp of supplierPrices) {
    const productId = sp.productId;
    if (!supplierCompareMap.has(productId)) {
      const content = sp.product.content as any;
      const name = content?.[locale]?.name || content?.en?.name || sp.product.slug;
      const firstVariant = sp.product.variants[0];
      supplierCompareMap.set(productId, {
        sku: firstVariant?.sku || sp.product.slug,
        name,
        currentCost: firstVariant?.costPrice ? Number(firstVariant.costPrice) : null,
        suppliers: [],
      });
    }
    supplierCompareMap.get(productId)!.suppliers.push({
      name: sp.supplier.name || "—",
      price: Number(sp.costPrice),
    });
  }

  const supplierCompareData = [...supplierCompareMap.values()];

  return (
    <div className="space-y-6">
      {/* Interactive Price Trend Charts with product selector */}
      <PriceTrendsInteractive locale={locale} currency={currency} />

      {/* Supplier Price Comparison (static) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("priceTrends.supplier_compare_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {supplierCompareData.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{t("priceTrends.sku")}</th>
                  <th className="text-left py-2 font-medium">{t("priceTrends.product")}</th>
                  <th className="text-right py-2 font-medium">{t("priceTrends.current_cost")}</th>
                  <th className="text-left py-2 font-medium">{t("priceTrends.suppliers")}</th>
                </tr>
              </thead>
              <tbody>
                {supplierCompareData.map((row) => {
                  const bestPrice = row.suppliers.length > 0 ? Math.min(...row.suppliers.map((s) => s.price)) : null;
                  return (
                    <tr key={row.sku} className="border-b hover:bg-slate-50">
                      <td className="py-3 font-mono text-xs">{row.sku}</td>
                      <td className="py-3">{row.name}</td>
                      <td className="py-3 text-right font-medium">
                        {row.currentCost !== null ? formatMoney(row.currentCost, { locale, currency }) : "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.suppliers.map((s, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                s.price === bestPrice
                                  ? "bg-green-100 text-green-700 font-medium"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {s.name}: {formatMoney(s.price, { locale, currency })}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("priceTrends.no_supplier_data")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
