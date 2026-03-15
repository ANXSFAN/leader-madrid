"use client";

import { Product, ProductVariant, Category } from "@prisma/client";
import { ProductCard, HighlightAttribute } from "./product-card";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

interface BestSellersProps {
  products: (Product & {
    category: Category | null;
    variants: ProductVariant[];
  })[];
  isB2B?: boolean;
  productPrices?: Record<string, number>;
  highlightAttributes?: HighlightAttribute[];
}

export function BestSellers({
  products,
  isB2B = false,
  productPrices = {},
  highlightAttributes = [],
}: BestSellersProps) {
  const t = useTranslations("home");

  return (
    <section className="py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-5xl font-bold text-foreground mb-3">
              {t("best_sellers")}
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              {t("best_sellers_subtitle")}
            </p>
          </div>
          <Link
            href="/search"
            className="hidden md:flex items-center text-accent hover:text-accent/80 font-medium"
          >
            {t("view_all")} <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product as any}
              isB2B={isB2B}
              price={productPrices[product.id]}
              highlightAttributes={highlightAttributes}
            />
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link
            href="/search"
            className="inline-flex items-center text-accent hover:text-accent/80 font-medium"
          >
            {t("view_all")} <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
