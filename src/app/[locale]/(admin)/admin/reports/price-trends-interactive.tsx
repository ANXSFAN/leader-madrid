"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  searchProductsForPriceTrends,
  getProductPriceHistory,
  type ProductSearchResult,
  type ProductPriceHistoryData,
} from "@/lib/actions/price-history";
import { ProductPriceHistory } from "@/components/admin/product-price-history";

interface PriceTrendsInteractiveProps {
  locale: string;
  currency: string;
}

export function PriceTrendsInteractive({
  locale,
  currency,
}: PriceTrendsInteractiveProps) {
  const t = useTranslations("admin.reports.priceTrends");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<
    { id: string; name: string; sku: string }[]
  >([]);

  const handleSearch = useCallback(async () => {
    if (!query || query.length < 2) return;
    setSearching(true);
    try {
      const results = await searchProductsForPriceTrends(query, locale);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, [query, locale]);

  const addProduct = (product: ProductSearchResult) => {
    if (selectedProducts.length >= 5) return;
    if (selectedProducts.some((p) => p.id === product.id)) return;
    setSelectedProducts((prev) => [
      ...prev,
      { id: product.id, name: product.name, sku: product.sku },
    ]);
    setSearchResults([]);
    setQuery("");
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t("interactive_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("search_placeholder")}
              className="pr-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button onClick={handleSearch} disabled={searching || query.length < 2} variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {searchResults.map((result) => {
              const alreadySelected = selectedProducts.some((p) => p.id === result.id);
              return (
                <button
                  key={result.id}
                  onClick={() => addProduct(result)}
                  disabled={alreadySelected || selectedProducts.length >= 5}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between text-sm disabled:opacity-50"
                >
                  <div>
                    <span className="font-medium">{result.name}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{result.sku}</span>
                  </div>
                  {alreadySelected && (
                    <span className="text-xs text-muted-foreground">{t("already_added")}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected products chips */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((p) => (
              <Badge key={p.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                <span className="text-xs">{p.name}</span>
                <span className="text-xs text-muted-foreground font-mono">({p.sku})</span>
                <button
                  onClick={() => removeProduct(p.id)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground self-center">
              {t("max_products", { current: selectedProducts.length, max: 5 })}
            </span>
          </div>
        )}

        {/* Price history charts for each selected product */}
        {selectedProducts.length > 0 ? (
          <div className="space-y-4 pt-2">
            {selectedProducts.map((p) => (
              <div key={p.id} className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">
                  {p.name} <span className="text-muted-foreground font-mono">({p.sku})</span>
                </h4>
                <ProductPriceHistory
                  productId={p.id}
                  locale={locale}
                  currency={currency}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("empty_state")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
