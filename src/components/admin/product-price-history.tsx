"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  getProductPriceHistory,
  type ProductPriceHistoryData,
} from "@/lib/actions/price-history";
import { formatMoney } from "@/lib/formatters";

const PURCHASE_COLOR = "#e67e22";
const SALES_COLOR = "#1e3a5f";

interface ProductPriceHistoryProps {
  productId: string;
  locale: string;
  currency: string;
}

export function ProductPriceHistory({
  productId,
  locale,
  currency,
}: ProductPriceHistoryProps) {
  const t = useTranslations("admin.products.priceHistory");
  const [data, setData] = useState<ProductPriceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductPriceHistory(productId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const hasAnyData = data.variants.some((v) =>
    v.data.some((d) => d.purchasePrice !== null || d.sellingPrice !== null)
  );

  return (
    <div className="space-y-6">
      {data.variants.map((variant) => {
        const hasData = variant.data.some(
          (d) => d.purchasePrice !== null || d.sellingPrice !== null
        );

        return (
          <Card key={variant.variantId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {data.variants.length > 1
                  ? `${t("variant_prefix")}: ${variant.sku}`
                  : t("chart_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={variant.data}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => {
                        // Show MM-DD for compact display
                        const parts = v.split("-");
                        return parts.length === 3 ? `${parts[1]}-${parts[2]}` : v;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        formatMoney(v, { locale, currency })
                      }
                    />
                    <Tooltip
                      formatter={((value: number, name: string) => [
                        formatMoney(value, { locale, currency }),
                        name,
                      ]) as any}
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="purchasePrice"
                      stroke={PURCHASE_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                      name={t("purchase_price")}
                    />
                    <Line
                      type="monotone"
                      dataKey="sellingPrice"
                      stroke={SALES_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                      name={t("selling_price")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("no_data")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Supplier Quotes */}
      {data.supplierQuotes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t("supplier_quotes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.currentCostPrice !== null && (
                <div className="flex items-center justify-between text-sm pb-2 border-b">
                  <span className="text-muted-foreground">
                    {t("current_cost")}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(data.currentCostPrice, { locale, currency })}
                  </span>
                </div>
              )}
              {(() => {
                const bestPrice = Math.min(
                  ...data.supplierQuotes.map((q) => q.costPrice)
                );
                return data.supplierQuotes.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{q.supplierName}</span>
                    <span
                      className={`font-mono font-medium px-2 py-0.5 rounded ${
                        q.costPrice === bestPrice
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {formatMoney(q.costPrice, { locale, currency })}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasAnyData && data.supplierQuotes.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("no_history")}
        </p>
      )}
    </div>
  );
}
