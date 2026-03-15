"use client";

import React, { useState, useTransition } from "react";
import {
  ChevronRight,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Category } from "@prisma/client";
import { SerializedProduct } from "@/lib/types/search";
import { Facet } from "@/lib/actions/search";
import { AttributeWithOptions } from "@/lib/actions/attributes";
import { ProductCard, HighlightAttribute } from "./product-card";
import { ProductFilter } from "./product-filter";
import { Link } from "@/i18n/navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLocalized } from "@/lib/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useTranslations } from "next-intl";

interface ProductListViewProps {
  initialProducts: SerializedProduct[];
  total: number;
  facets: Record<string, Facet>;
  attributes?: AttributeWithOptions[];
  category: Category;
  isB2B: boolean;
  productPrices: Record<string, number>;
  searchParams: { [key: string]: string | string[] | undefined };
  allCategories?: (Category & { children?: Category[] })[];
  useQueryParams?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export function ProductListView({
  initialProducts,
  total,
  facets,
  attributes = [],
  category,
  isB2B,
  productPrices,
  searchParams: initialSearchParams,
  allCategories = [],
  useQueryParams = false,
  minPrice = 0,
  maxPrice = 1000,
}: ProductListViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isPending, startTransition] = useTransition();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("product_list");
  const tFilter = useTranslations("filter");

  const categoryContent = getLocalized(category.content, locale);

  // Extract highlight attributes for product cards
  const highlightAttrs: HighlightAttribute[] = attributes
    .filter((a) => a.isHighlight)
    .map((a) => ({ key: a.key, name: a.name, unit: a.unit }));

  // Look up the localized display name for a facet key
  const getFacetLabel = (key: string): string => {
    const attr = attributes.find((a) => a.key === key);
    if (attr) {
      return attr.name[locale] || attr.name["en"] || key;
    }
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Helper to update URL
  const createQueryString = (
    params: Record<string, string | string[] | null>
  ) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newSearchParams.delete(key);
      } else if (Array.isArray(value)) {
        newSearchParams.delete(key);
        value.forEach((v) => newSearchParams.append(key, v));
      } else {
        newSearchParams.set(key, value);
      }
    });

    if (!params.page) {
      newSearchParams.set("page", "1");
    }

    return newSearchParams.toString();
  };

  const handleCategorySelect = (slug: string) => {
    startTransition(() => {
      if (useQueryParams) {
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set("category", slug);
        newSearchParams.set("page", "1");
        router.push(`?${newSearchParams.toString()}`, { scroll: false });
      } else {
        router.push(`/category/${slug}`);
      }
    });
  };

  const removeFilter = (key: string, value: string) => {
    const currentValues = searchParams.getAll(key);
    const newValues = currentValues.filter((v) => v !== value);
    const paramValue = newValues.length > 0 ? newValues : null;

    startTransition(() => {
      router.push(`?${createQueryString({ [key]: paramValue })}`, {
        scroll: false,
      });
    });
  };

  const removePrice = () => {
    startTransition(() => {
      router.push(
        `?${createQueryString({ minPrice: null, maxPrice: null })}`,
        { scroll: false }
      );
    });
  };

  const removeAvailability = () => {
    startTransition(() => {
      router.push(`?${createQueryString({ availability: null })}`, {
        scroll: false,
      });
    });
  };

  const updateSort = (sort: string) => {
    startTransition(() => {
      router.push(`?${createQueryString({ sort })}`, { scroll: false });
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push(window.location.pathname);
    });
  };

  // Pagination Logic
  const currentPage = Number(searchParams.get("page")) || 1;
  const totalPages = Math.ceil(total / 12);

  const goToPage = (page: number) => {
    startTransition(() => {
      router.push(`?${createQueryString({ page: String(page) })}`);
    });
  };

  // Build active filter chips
  const ignoredKeys = new Set(["page", "sort", "categoryId", "query", "category"]);
  const activeChips: { key: string; value: string; label: string; onRemove: () => void }[] = [];

  // Price chip
  const hasMinPrice = searchParams.has("minPrice");
  const hasMaxPrice = searchParams.has("maxPrice");
  if (hasMinPrice || hasMaxPrice) {
    const min = searchParams.get("minPrice") || String(minPrice);
    const max = searchParams.get("maxPrice") || String(maxPrice);
    activeChips.push({
      key: "price",
      value: `${min}-${max}`,
      label: `${tFilter("price_range")}: \u20AC${min} \u2013 \u20AC${max}`,
      onRemove: removePrice,
    });
  }

  // Availability chip
  const availability = searchParams.get("availability");
  if (availability) {
    const availLabel =
      availability === "in_stock"
        ? tFilter("in_stock")
        : availability === "out_of_stock"
          ? tFilter("out_of_stock")
          : availability;
    activeChips.push({
      key: "availability",
      value: availability,
      label: `${tFilter("availability")}: ${availLabel}`,
      onRemove: removeAvailability,
    });
  }

  // Facet chips
  for (const [key, value] of searchParams.entries()) {
    if (ignoredKeys.has(key) || key === "minPrice" || key === "maxPrice" || key === "availability") continue;
    const facetLabel = getFacetLabel(key);
    activeChips.push({
      key,
      value,
      label: `${facetLabel}: ${value}`,
      onRemove: () => removeFilter(key, value),
    });
  }

  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="bg-card min-h-screen font-sans">
      {/* --- Breadcrumbs --- */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">
          <Link href="/" className="hover:text-accent transition-colors">
            {t("breadcrumb_home")}
          </Link>
          <ChevronRight size={12} />
          <Link href="#" className="hover:text-accent transition-colors">
            {t("breadcrumb_products")}
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground">{categoryContent.name}</span>
        </div>
      </div>

      {/* --- Header & Title --- */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-bold text-foreground tracking-tight">
              {categoryContent.name}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl font-medium">
              {categoryContent.description ||
                t("explore_collection", { name: categoryContent.name })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                {t("results_label")}
              </p>
              <p className="text-base font-bold text-foreground">
                {t("showing", {
                  from: (currentPage - 1) * 12 + 1,
                  to: Math.min(currentPage * 12, total),
                  total,
                })}
              </p>
            </div>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* --- Sidebar Filters (Desktop) --- */}
          <aside className="lg:w-1/4 hidden lg:block">
            <ProductFilter
              facets={facets}
              attributes={attributes}
              minPrice={minPrice}
              maxPrice={maxPrice}
              categories={allCategories as any}
              currentCategoryId={category.id}
              useQueryParams={useQueryParams}
              onCategorySelect={handleCategorySelect}
              showAvailability={false}
              scrollToProducts={false}
            />

            {/* B2B Banner in Sidebar */}
            <div className="mt-8 bg-primary rounded-2xl p-6 text-primary-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-accent rounded-full -translate-y-1/2 translate-x-1/2 opacity-20"></div>
              <h4 className="font-bold text-xl leading-tight mb-2">
                {t("b2b_title")}
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                {t("b2b_description")}
              </p>
              <Link href="/apply-b2b" className="block w-full py-2 bg-accent text-accent-foreground font-bold text-[11px] uppercase tracking-widest rounded-lg hover:opacity-90 transition-colors text-center">
                {t("b2b_button")}
              </Link>
            </div>
          </aside>

          {/* Mobile Filter Trigger */}
          <div className="lg:hidden w-full mb-6">
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full flex justify-between"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal size={16} /> {t("mobile_filters")}
                  </span>
                  <span className="bg-secondary px-2 py-0.5 rounded-full text-sm font-bold">
                    {t("results_count", { count: total })}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] sm:w-[400px] overflow-y-auto flex flex-col">
                <div className="flex-1 py-4">
                  <ProductFilter
                    facets={facets}
                    attributes={attributes}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    categories={allCategories as any}
                    currentCategoryId={category.id}
                    useQueryParams={useQueryParams}
                    onCategorySelect={handleCategorySelect}
                    showAvailability={false}
                    scrollToProducts={false}
                  />
                </div>
                <div className="sticky bottom-0 bg-background border-t border-border p-4">
                  <Button
                    className="w-full"
                    onClick={() => setMobileFilterOpen(false)}
                  >
                    {tFilter("show_n_results", { count: total })}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* --- Main Product Grid --- */}
          <main className="lg:w-3/4 w-full">
            {/* Sorting & Active Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
              <div className="flex flex-wrap gap-2 items-center">
                {hasActiveFilters && (
                  <>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest self-center mr-2">
                      {tFilter("active_filters")}
                    </span>
                    {activeChips.map((chip, i) => (
                      <div
                        key={`${chip.key}-${chip.value}-${i}`}
                        className="flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent"
                      >
                        {chip.label}
                        <button onClick={chip.onRemove}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={clearAllFilters}
                      className="text-[11px] font-bold text-muted-foreground hover:text-red-500 ml-2"
                    >
                      {t("clear_all")}
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("sort_by")}
                </span>
                <select
                  onChange={(e) => updateSort(e.target.value)}
                  value={searchParams.get("sort") || ""}
                  className="text-base font-bold text-foreground border-none focus:ring-0 bg-transparent cursor-pointer"
                >
                  <option value="">{t("sort_relevance")}</option>
                  <option value="price_asc">{t("sort_price_asc")}</option>
                  <option value="price_desc">{t("sort_price_desc")}</option>
                  <option value="newest">{t("sort_newest")}</option>
                </select>
              </div>
            </div>

            {/* Products List */}
            {isPending ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8"
                    : "space-y-6"
                }
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8"
                    : "space-y-6"
                }
              >
                {initialProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isB2B={isB2B}
                    price={productPrices[product.id]}
                    viewMode={viewMode}
                    highlightAttributes={highlightAttrs}
                  />
                ))}
              </div>
            )}

            {/* --- Pagination --- */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-accent hover:text-accent transition-all disabled:opacity-50"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>

                <span className="text-base font-bold text-foreground">
                  {t("page_of", { current: currentPage, total: totalPages })}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-accent hover:text-accent transition-all disabled:opacity-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* --- Bulk Quote CTA --- */}
      <div className="border-t border-border py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground tracking-tight mb-4">
            {t("cta_title")}
          </h2>
          <p className="text-muted-foreground mb-8">
            {t("cta_description")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/rfq" className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl uppercase text-sm tracking-widest hover:opacity-90 transition-all">
              {t("cta_quote")}
            </Link>
            <Link href="/contact" className="px-8 py-4 border-2 border-primary text-foreground font-bold rounded-xl uppercase text-sm tracking-widest hover:bg-primary hover:text-primary-foreground transition-all">
              {t("cta_expert")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
