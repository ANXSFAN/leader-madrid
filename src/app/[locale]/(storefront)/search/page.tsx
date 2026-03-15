export const revalidate = 30;

import { searchProducts, SearchParams } from "@/lib/actions/search";
import { getGlobalAttributes } from "@/lib/actions/attributes";
import { ProductFilter } from "@/components/storefront/product-filter";
import { ProductCard } from "@/components/storefront/product-card";
import { SearchControls } from "@/components/storefront/search-controls";
import { PaginationControl } from "@/components/storefront/pagination-control";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBatchProductPricesInCurrency } from "@/lib/pricing";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.query === "string" ? searchParams.query : undefined;
  const title = query ? `"${query}" – Search Results` : "Product Search";
  const description = query
    ? `Find LED products matching "${query}". Browse our full catalog.`
    : "Search our complete LED lighting catalog. Filter by category, price, and specifications.";

  return {
    title,
    description,
    robots: { index: false, follow: true }, // Search result pages shouldn't be indexed
  };
}

// Loading Skeleton
function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="hidden md:block col-span-1 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const isB2B = session?.user?.b2bStatus === "APPROVED";
  const t = await getTranslations({ locale: params.locale, namespace: "search" });

  const query =
    typeof searchParams.query === "string" ? searchParams.query : undefined;
  const page =
    typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const sort =
    typeof searchParams.sort === "string"
      ? (searchParams.sort as any)
      : undefined;
  const minPrice =
    typeof searchParams.minPrice === "string"
      ? Number(searchParams.minPrice)
      : undefined;
  const maxPrice =
    typeof searchParams.maxPrice === "string"
      ? Number(searchParams.maxPrice)
      : undefined;

  const availability =
    typeof searchParams.availability === "string"
      ? searchParams.availability
      : undefined;

  // Extract specs
  const specs: Record<string, string | string[]> = {};
  Object.keys(searchParams).forEach((key) => {
    if (["query", "page", "sort", "minPrice", "maxPrice", "availability"].includes(key)) return;
    const value = searchParams[key];
    if (value) specs[key] = value;
  });

  const parsedParams: SearchParams = {
    query,
    page,
    sort,
    priceRange:
      minPrice !== undefined && maxPrice !== undefined
        ? [minPrice, maxPrice]
        : undefined,
    specs,
    availability: availability as SearchParams["availability"],
  };

  const [
    { products, total, facets, minPrice: globalMin, maxPrice: globalMax },
    attributes,
  ] = await Promise.all([searchProducts(parsedParams), getGlobalAttributes()]);

  const totalPages = Math.ceil(total / 12);

  // Extract highlight attributes for product cards
  const highlightAttributes = attributes
    .filter((a) => a.isHighlight)
    .map((a) => ({ key: a.key, name: a.name, unit: a.unit }));

  // Resolve display currency
  const displayCurrency = await resolveDisplayCurrency(params.locale);

  // Calculate prices for each product (first variant) in display currency
  const productPrices: Record<string, number> = {};
  const variantIds: string[] = [];
  const productVariantMap: Record<string, string> = {};

  products.forEach((p) => {
    if (p.variants.length > 0) {
      const vId = p.variants[0].id;
      variantIds.push(vId);
      productVariantMap[vId] = p.id;
    }
  });

  if (variantIds.length > 0) {
    const batchPrices = await getBatchProductPricesInCurrency(
      session?.user?.id,
      variantIds,
      displayCurrency
    );

    Object.entries(batchPrices).forEach(([vId, price]) => {
      const pId = productVariantMap[vId];
      if (pId) {
        productPrices[pId] = price;
      }
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-8 border-b border-border pb-4 gap-4">
        <h1 className="text-3xl font-bold text-foreground">
          {query ? t("results_for", { query }) : t("all_products_heading")}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {t("products_count", { count: total })}
          </span>
        </h1>
      </div>

      {/* Controls: Mobile Filter & Sort */}
      <SearchControls
        facets={facets}
        attributes={attributes}
        minPrice={globalMin}
        maxPrice={globalMax}
        total={total}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters (Desktop) */}
        <aside className="hidden lg:block lg:col-span-1">
          <ProductFilter
            facets={facets}
            attributes={attributes}
            minPrice={globalMin}
            maxPrice={globalMax}
            showAvailability={true}
          />
        </aside>

        {/* Product Grid */}
        <main id="products-section" className="lg:col-span-3">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-secondary rounded-xl text-center px-4">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center shadow-sm mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t("no_results_title")}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                {t("no_results_description")}
              </p>

              <div className="space-y-4 w-full max-w-sm">
                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    {t("suggestions_title")}
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-center gap-2">
                      <span className="text-accent">•</span>
                      {t("suggestion_spelling")}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent">•</span>
                      {t("suggestion_generic")}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent">•</span>
                      {t("suggestion_remove_filters")}
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/search">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {t("view_led")}
                    </Link>
                  </Button>
                  <Button asChild className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {t("back_home")}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isB2B={isB2B}
                    price={productPrices[product.id]}
                    currency={displayCurrency}
                    highlightAttributes={highlightAttributes}
                  />
                ))}
              </div>

              <PaginationControl currentPage={page} totalPages={totalPages} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
