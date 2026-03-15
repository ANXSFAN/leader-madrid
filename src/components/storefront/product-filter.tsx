"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, useRef } from "react";
import { Facet } from "@/lib/actions/search";
import { AttributeWithOptions } from "@/lib/actions/attributes";
import { useDebounce } from "@/hooks/use-debounce";
import { Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryTreeItem } from "@/components/storefront/category-tree";
import { useTranslations, useLocale } from "next-intl";
import { Category } from "@prisma/client";

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

interface ProductFilterProps {
  facets: Record<string, Facet>;
  attributes: AttributeWithOptions[];
  minPrice?: number;
  maxPrice?: number;
  className?: string;
  scrollToProducts?: boolean;
  categories?: CategoryWithChildren[];
  currentCategoryId?: string;
  useQueryParams?: boolean;
  onCategorySelect?: (slug: string) => void;
  showAvailability?: boolean;
}

// Safe number parse: returns null if param doesn't exist, number otherwise
function parseUrlNumber(val: string | null): number | null {
  if (val === null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export function ProductFilter({
  facets,
  attributes,
  minPrice: initialMin = 0,
  maxPrice: initialMax = 1000,
  className,
  scrollToProducts = true,
  categories,
  currentCategoryId,
  useQueryParams = false,
  onCategorySelect,
  showAvailability = false,
}: ProductFilterProps) {
  const t = useTranslations("filter");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Case-insensitive matching: facet key → attribute, and attribute key → facet key
  const { matchedFacets, attrFacetMap } = useMemo(() => {
    // Build case-insensitive lookup from attribute keys and names
    const lowerLookup = new Map<string, AttributeWithOptions>();
    for (const attr of attributes) {
      lowerLookup.set(attr.key.toLowerCase(), attr);
      for (const name of Object.values(attr.name)) {
        if (name) lowerLookup.set(name.toLowerCase(), attr);
      }
    }

    const matched = new Map<string, AttributeWithOptions>(); // facetKey → attr
    const attrMap = new Map<string, string>(); // attr.key → first matching facetKey

    for (const facetKey of Object.keys(facets)) {
      const attr = lowerLookup.get(facetKey.toLowerCase());
      if (attr) {
        matched.set(facetKey, attr);
        if (!attrMap.has(attr.key)) {
          attrMap.set(attr.key, facetKey);
        }
      }
    }

    return { matchedFacets: matched, attrFacetMap: attrMap };
  }, [attributes, facets]);

  const scrollToTop = () => {
    if (scrollToProducts) {
      const productsSection = document.getElementById("products-section");
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  // ------------------------------------------------------------------
  // Price Range: stable slider bounds + local state for smooth dragging
  // ------------------------------------------------------------------

  // Remember the full price range (unfiltered). Only update when there's
  // no price filter active in the URL, so the slider never "clips" after
  // the user drags it.
  const sliderBoundsRef = useRef<[number, number]>([initialMin, initialMax]);
  if (!searchParams.has("minPrice") && !searchParams.has("maxPrice")) {
    sliderBoundsRef.current = [initialMin, initialMax];
  }
  const sliderMin = sliderBoundsRef.current[0];
  const sliderMax = sliderBoundsRef.current[1];

  // Track explicit user interaction with price controls.
  // This prevents the debounce effect from pushing stale price values
  // to the URL when initialMin/initialMax change (navigation, facet changes).
  const userInteractedWithPrice = useRef(false);

  // Local price state for smooth slider dragging
  const urlMin = parseUrlNumber(searchParams.get("minPrice"));
  const urlMax = parseUrlNumber(searchParams.get("maxPrice"));

  const [priceRange, setPriceRange] = useState<[number, number]>([
    urlMin ?? initialMin,
    urlMax ?? initialMax,
  ]);

  const debouncedPriceRange = useDebounce(priceRange, 500);

  // Sync local state when URL params or props change
  useEffect(() => {
    const hasMin = searchParams.has("minPrice");
    const hasMax = searchParams.has("maxPrice");

    if (!hasMin && !hasMax) {
      // No price filter in URL → reset to full range
      setPriceRange([initialMin, initialMax]);
      userInteractedWithPrice.current = false;
    } else {
      // Price filter exists → sync from URL (authoritative)
      const min = hasMin ? Number(searchParams.get("minPrice")) : initialMin;
      const max = hasMax ? Number(searchParams.get("maxPrice")) : initialMax;
      setPriceRange([min, max]);
    }
  }, [initialMin, initialMax, searchParams]);

  // Update URL helper
  const createQueryString = useCallback(
    (params: Record<string, string | string[] | null>) => {
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

      newSearchParams.set("page", "1");
      return newSearchParams.toString();
    },
    [searchParams]
  );

  // Push price to URL after debounce — only when user explicitly interacted
  useEffect(() => {
    // Skip if user hasn't interacted with the price controls.
    // This prevents stale debounced values from pushing to URL when
    // initialMin/initialMax change due to navigation or facet changes.
    if (!userInteractedWithPrice.current) return;

    const currentMin = parseUrlNumber(searchParams.get("minPrice")) ?? sliderMin;
    const currentMax = parseUrlNumber(searchParams.get("maxPrice")) ?? sliderMax;

    if (
      debouncedPriceRange[0] !== currentMin ||
      debouncedPriceRange[1] !== currentMax
    ) {
      // Don't push if debounced value equals the full range (no filter needed)
      if (
        debouncedPriceRange[0] === sliderMin &&
        debouncedPriceRange[1] === sliderMax
      ) {
        // Remove price params instead
        if (searchParams.has("minPrice") || searchParams.has("maxPrice")) {
          startTransition(() => {
            router.push(
              `?${createQueryString({ minPrice: null, maxPrice: null })}`,
              { scroll: false }
            );
          });
        }
        return;
      }

      startTransition(() => {
        router.push(
          `?${createQueryString({
            minPrice: String(debouncedPriceRange[0]),
            maxPrice: String(debouncedPriceRange[1]),
          })}`,
          { scroll: false }
        );
      });
    }
  }, [
    debouncedPriceRange,
    createQueryString,
    router,
    searchParams,
    sliderMin,
    sliderMax,
  ]);

  // ------------------------------------------------------------------
  // Facet toggle with debounce
  // ------------------------------------------------------------------
  const pendingRef = useRef<Record<string, string[]>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localFilters, setLocalFilters] = useState<Record<string, string[]>>({});

  const getFilterValues = (key: string): string[] =>
    key in localFilters ? localFilters[key] : searchParams.getAll(key);

  useEffect(() => {
    setLocalFilters({});
    pendingRef.current = {};
  }, [searchParams]);

  const toggleSpec = (key: string, value: string) => {
    const current = getFilterValues(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    const newFilters = { ...localFilters, [key]: next };
    pendingRef.current = newFilters;
    setLocalFilters(newFilters);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params: Record<string, string | string[] | null> = {};
      Object.entries(pendingRef.current).forEach(([k, v]) => {
        params[k] = v.length > 0 ? v : null;
      });
      startTransition(() => {
        router.push(`?${createQueryString(params)}`, { scroll: false });
      });
    }, 300);
  };

  const toggleAvailability = (value: string) => {
    const current = searchParams.get("availability");
    const newValue = current === value ? null : value;

    startTransition(() => {
      router.push(`?${createQueryString({ availability: newValue })}`, {
        scroll: false,
      });
    });
  };

  // ------------------------------------------------------------------
  // Clear / labels
  // ------------------------------------------------------------------
  const hasActiveFilters = (() => {
    for (const [key] of searchParams.entries()) {
      if (!["page", "sort", "query", "category", "categoryId"].includes(key)) {
        return true;
      }
    }
    return false;
  })();

  const clearAll = () => {
    const newSearchParams = new URLSearchParams();
    const preserve = ["query", "sort", "category", "categoryId"];
    preserve.forEach((key) => {
      const val = searchParams.get(key);
      if (val) newSearchParams.set(key, val);
    });

    startTransition(() => {
      router.push(`?${newSearchParams.toString()}`);
      scrollToTop();
    });
    setPriceRange([sliderMin, sliderMax]);
    userInteractedWithPrice.current = false;
  };

  const getFacetLabel = (key: string): string => {
    const attr = matchedFacets.get(key);
    if (attr) {
      return attr.name[locale] || attr.name["en"] || key;
    }
    if (key === "brand") return t("brand");
    if (key === "tags") return t("tags");
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // ------------------------------------------------------------------
  // Facet rendering (color swatches / grid / checkbox)
  // ------------------------------------------------------------------
  const renderFacetOptions = (key: string, facet: Facet) => {
    const attribute = matchedFacets.get(key);
    // 1. Color Swatches
    const hasColorOptions = attribute?.options.some((o) => o.color);

    if (hasColorOptions || key === "color" || key === "finish") {
      return (
        <div className="flex flex-wrap gap-2">
          {facet.options.map((option) => {
            const isChecked = getFilterValues(key).includes(option.value);
            const attrOption = attribute?.options.find(
              (o) => o.value === option.value
            );
            const colorCode = attrOption?.color || option.value;

            const isWhite =
              colorCode.toLowerCase() === "white" ||
              colorCode.toLowerCase() === "#ffffff" ||
              colorCode.toLowerCase() === "#fff";

            return (
              <button
                key={option.value}
                onClick={() => toggleSpec(key, option.value)}
                className={cn(
                  "w-8 h-8 rounded-full border flex items-center justify-center transition-all relative",
                  isChecked
                    ? "ring-2 ring-primary ring-offset-2 border-transparent"
                    : "hover:scale-110 border-border",
                  isWhite ? "bg-white" : "border-transparent"
                )}
                style={{ backgroundColor: colorCode }}
                title={`${option.value} (${option.count})`}
              >
                {isChecked && (
                  <Check
                    size={14}
                    className={cn(
                      "stroke-[3]",
                      isWhite ? "text-foreground" : "text-white"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      );
    }

    // 2. Grid Layout for Short Values
    const isShortValues = facet.options.every((opt) => opt.value.length < 6);

    if (isShortValues) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {facet.options.map((option) => {
            const isChecked = getFilterValues(key).includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggleSpec(key, option.value)}
                className={cn(
                  "px-2 py-1.5 rounded border text-base text-center transition-colors truncate",
                  isChecked
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-foreground/80 border-border hover:border-border"
                )}
                title={`${option.value} (${option.count})`}
              >
                {option.value}
              </button>
            );
          })}
        </div>
      );
    }

    // 3. Default: Checkbox List
    const options = facet.options;
    const needsScroll = options.length > 8;

    const content = (
      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = getFilterValues(key).includes(option.value);
          return (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${key}-${option.value}`}
                checked={isChecked}
                onCheckedChange={() => toggleSpec(key, option.value)}
              />
              <Label
                htmlFor={`${key}-${option.value}`}
                className="text-base font-normal text-muted-foreground flex-1 cursor-pointer flex justify-between"
              >
                <span>{option.value}</span>
                <span className="text-muted-foreground text-sm">
                  ({option.count})
                </span>
              </Label>
            </div>
          );
        })}
      </div>
    );

    if (needsScroll) {
      return <ScrollArea className="h-56">{content}</ScrollArea>;
    }

    return content;
  };

  const currentAvailability = searchParams.get("availability");
  const showSlider = sliderMax > sliderMin;

  return (
    <div
      className={cn(
        "space-y-6 relative",
        className,
      )}
    >
      {/* Header + Clear All */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
            <Filter size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-foreground">{t("title")}</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 h-auto p-0"
              >
                {t("clear_all")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tree (optional) */}
      {categories && categories.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-base font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-4 bg-accent rounded-full" />
            {t("categories")}
          </h4>
          <ul className="space-y-1">
            {categories.map((cat) => (
              <CategoryTreeItem
                key={cat.id}
                category={cat}
                currentCategoryId={currentCategoryId || ""}
                useQueryParams={useQueryParams}
                onSelect={onCategorySelect}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Price Filter */}
      {showSlider && (
        <div className="space-y-4 p-4 bg-secondary rounded-lg border border-border">
          <h4 className="font-medium text-base text-foreground">
            {t("price_range")}
          </h4>
          <Slider
            value={priceRange}
            min={sliderMin}
            max={sliderMax}
            step={1}
            minStepsBetweenThumbs={1}
            onValueChange={(value) => {
              userInteractedWithPrice.current = true;
              setPriceRange([value[0], value[1]]);
            }}
            className="py-4"
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground">{t("min")}</span>
              <Input
                type="number"
                value={priceRange[0]}
                min={sliderMin}
                max={priceRange[1]}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) {
                    userInteractedWithPrice.current = true;
                    setPriceRange([val, priceRange[1]]);
                  }
                }}
                className="h-8 bg-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground">{t("max")}</span>
              <Input
                type="number"
                value={priceRange[1]}
                min={priceRange[0]}
                max={sliderMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) {
                    userInteractedWithPrice.current = true;
                    setPriceRange([priceRange[0], val]);
                  }
                }}
                className="h-8 bg-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Facets */}
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={Object.keys(facets)}
      >
        {/* 1. Facets with AttributeDefinition (only isFilterable ones) */}
        {attributes.filter((a) => a.isFilterable).map((attr) => {
          // Find the actual facet key (could be display name like "InstalacióN")
          const facetKey = attrFacetMap.get(attr.key);
          if (!facetKey) return null;
          const facet = facets[facetKey];
          if (!facet || facet.options.length === 0) return null;

          const isActive = getFilterValues(facetKey).length > 0;

          return (
            <AccordionItem key={facetKey} value={facetKey}>
              <AccordionTrigger className="text-base font-medium text-foreground hover:no-underline hover:bg-secondary px-2 rounded-md capitalize">
                <span className="flex items-center gap-2">
                  {getFacetLabel(facetKey)}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pt-2 pb-4">
                {renderFacetOptions(facetKey, facet)}
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {/* 2. Remaining non-spec facets (brand, tags only) */}
        {Object.entries(facets).map(([key, facet]) => {
          if (matchedFacets.has(key)) return null;
          // Only show known built-in facets; hide unmatched spec-derived facets
          if (key !== "brand" && key !== "tags") return null;
          if (facet.options.length === 0) return null;

          const isActive = getFilterValues(key).length > 0;

          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-base font-medium text-foreground hover:no-underline hover:bg-secondary px-2 rounded-md capitalize">
                <span className="flex items-center gap-2">
                  {getFacetLabel(key)}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pt-2 pb-4">
                {renderFacetOptions(key, facet)}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Availability Filter */}
      {showAvailability && (
        <div className="space-y-3 p-4 bg-secondary rounded-lg border border-border">
          <h4 className="font-medium text-base text-foreground">
            {t("availability")}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="availability-in-stock"
                checked={currentAvailability === "in_stock"}
                onCheckedChange={() => toggleAvailability("in_stock")}
              />
              <Label
                htmlFor="availability-in-stock"
                className="text-base font-normal text-muted-foreground cursor-pointer"
              >
                {t("in_stock")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="availability-out-of-stock"
                checked={currentAvailability === "out_of_stock"}
                onCheckedChange={() => toggleAvailability("out_of_stock")}
              />
              <Label
                htmlFor="availability-out-of-stock"
                className="text-base font-normal text-muted-foreground cursor-pointer"
              >
                {t("out_of_stock")}
              </Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
