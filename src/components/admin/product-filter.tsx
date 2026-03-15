"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Filter, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { getLocalized } from "@/lib/content";

interface CategoryOption {
  id: string;
  content: any;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductFilterProps {
  categories: CategoryOption[];
  suppliers: SupplierOption[];
}

// Parse comma-separated URL param into array
function parseMulti(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

export function ProductFilter({ categories, suppliers }: ProductFilterProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin.products");
  const searchParams = useSearchParams();

  // Read current URL params
  const currentStatus = searchParams.get("status") || "";
  const currentTypes = parseMulti(searchParams.get("type"));
  const currentCategoryIds = parseMulti(searchParams.get("categoryId"));
  const currentSupplierIds = parseMulti(searchParams.get("supplierId"));
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentStockStatuses = parseMulti(searchParams.get("stockStatus"));

  // Local state for the Sheet form
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [types, setTypes] = useState<string[]>(currentTypes);
  const [categoryIds, setCategoryIds] = useState<string[]>(currentCategoryIds);
  const [supplierIds, setSupplierIds] = useState<string[]>(currentSupplierIds);
  const [minPrice, setMinPrice] = useState(currentMinPrice);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Number(currentMinPrice) || 0,
    Number(currentMaxPrice) || 1000,
  ]);
  const [stockStatuses, setStockStatuses] = useState<string[]>(currentStockStatuses);
  const [categorySearch, setCategorySearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  // Count active filters from URL params (not local state)
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; paramKey: string; paramValue?: string }[] = [];

    if (currentStatus === "active") {
      chips.push({ key: "status", label: t("filter.active"), paramKey: "status" });
    } else if (currentStatus === "inactive") {
      chips.push({ key: "status", label: t("filter.inactive"), paramKey: "status" });
    }

    for (const type of currentTypes) {
      chips.push({
        key: `type-${type}`,
        label: type === "SIMPLE" ? t("filter.simple") : t("filter.bundle"),
        paramKey: "type",
        paramValue: type,
      });
    }

    for (const catId of currentCategoryIds) {
      const cat = categories.find((c) => c.id === catId);
      if (cat) {
        const catContent = getLocalized(cat.content, locale);
        chips.push({
          key: `cat-${catId}`,
          label: catContent.name,
          paramKey: "categoryId",
          paramValue: catId,
        });
      }
    }

    for (const supId of currentSupplierIds) {
      const sup = suppliers.find((s) => s.id === supId);
      if (sup) {
        chips.push({
          key: `sup-${supId}`,
          label: sup.name,
          paramKey: "supplierId",
          paramValue: supId,
        });
      }
    }

    if (currentMinPrice || currentMaxPrice) {
      const min = currentMinPrice || "0";
      const max = currentMaxPrice || "∞";
      chips.push({
        key: "price",
        label: `€${min} – €${max}`,
        paramKey: "price",
      });
    }

    for (const ss of currentStockStatuses) {
      const labelMap: Record<string, string> = {
        in_stock: t("filter.in_stock"),
        low_stock: t("filter.low_stock"),
        out_of_stock: t("filter.out_of_stock"),
      };
      chips.push({
        key: `stock-${ss}`,
        label: labelMap[ss] || ss,
        paramKey: "stockStatus",
        paramValue: ss,
      });
    }

    return chips;
  }, [currentStatus, currentTypes, currentCategoryIds, currentSupplierIds, currentMinPrice, currentMaxPrice, currentStockStatuses, categories, suppliers, locale, t]);

  // Filtered lists for search
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((cat) => {
      const catContent = getLocalized(cat.content, locale);
      return catContent.name.toLowerCase().includes(q);
    });
  }, [categories, categorySearch, locale]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  // Toggle helpers
  const toggleArrayItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  };

  // Sync local state when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStatus(currentStatus);
      setTypes(currentTypes);
      setCategoryIds(currentCategoryIds);
      setSupplierIds(currentSupplierIds);
      setMinPrice(currentMinPrice);
      setMaxPrice(currentMaxPrice);
      setPriceRange([Number(currentMinPrice) || 0, Number(currentMaxPrice) || 1000]);
      setStockStatuses(currentStockStatuses);
      setCategorySearch("");
      setSupplierSearch("");
    }
    setOpen(isOpen);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Status
    if (status && status !== "all") {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    // Type
    if (types.length > 0) {
      params.set("type", types.join(","));
    } else {
      params.delete("type");
    }

    // Category (multi-select)
    if (categoryIds.length > 0) {
      params.set("categoryId", categoryIds.join(","));
    } else {
      params.delete("categoryId");
    }

    // Supplier
    if (supplierIds.length > 0) {
      params.set("supplierId", supplierIds.join(","));
    } else {
      params.delete("supplierId");
    }

    // Price range
    if (minPrice && Number(minPrice) > 0) {
      params.set("minPrice", minPrice);
    } else {
      params.delete("minPrice");
    }
    if (maxPrice && Number(maxPrice) > 0 && Number(maxPrice) < 1000) {
      params.set("maxPrice", maxPrice);
    } else {
      params.delete("maxPrice");
    }

    // Stock status
    if (stockStatuses.length > 0) {
      params.set("stockStatus", stockStatuses.join(","));
    } else {
      params.delete("stockStatus");
    }

    params.set("page", "1");
    router.push(`?${params.toString()}`);
    setOpen(false);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("type");
    params.delete("categoryId");
    params.delete("supplierId");
    params.delete("minPrice");
    params.delete("maxPrice");
    params.delete("stockStatus");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
    setOpen(false);
    // Reset local state
    setStatus("");
    setTypes([]);
    setCategoryIds([]);
    setSupplierIds([]);
    setMinPrice("");
    setMaxPrice("");
    setPriceRange([0, 1000]);
    setStockStatuses([]);
  };

  // Remove a single chip filter from URL
  const removeChip = (chip: { paramKey: string; paramValue?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (chip.paramKey === "price") {
      params.delete("minPrice");
      params.delete("maxPrice");
    } else if (chip.paramKey === "status") {
      params.delete("status");
    } else if (chip.paramValue) {
      // Multi-value param: remove single value
      const current = parseMulti(params.get(chip.paramKey));
      const updated = current.filter((v) => v !== chip.paramValue);
      if (updated.length > 0) {
        params.set(chip.paramKey, updated.join(","));
      } else {
        params.delete(chip.paramKey);
      }
    }

    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      {/* Filter Button */}
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <Filter className="h-4 w-4" />
          {t("actions.filter")}
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px]">
              {activeFilters.length}
            </Badge>
          )}
        </Button>

        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] flex flex-col">
          <SheetHeader>
            <div className="flex items-center justify-between pr-6">
              <SheetTitle>{t("filter.title")}</SheetTitle>
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("filter.clear_all")}
                </Button>
              )}
            </div>
            <SheetDescription className="sr-only">
              {t("filter.title")}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <Accordion
              type="multiple"
              defaultValue={["status", "product_type", "category", "supplier", "price_range", "stock_status"]}
              className="w-full"
            >
              {/* 1. Status */}
              <AccordionItem value="status">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.status")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex gap-1">
                    {(["all", "active", "inactive"] as const).map((val) => (
                      <Button
                        key={val}
                        variant={status === (val === "all" ? "" : val) || (val === "all" && !status) ? "default" : "outline"}
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setStatus(val === "all" ? "" : val)}
                      >
                        {val === "all" ? t("filter.all") : t(`filter.${val}`)}
                      </Button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 2. Product Type */}
              <AccordionItem value="product_type">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.product_type")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {(["SIMPLE", "BUNDLE"] as const).map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={types.includes(type)}
                          onCheckedChange={() => setTypes(toggleArrayItem(types, type))}
                        />
                        <span className="text-sm">
                          {type === "SIMPLE" ? t("filter.simple") : t("filter.bundle")}
                        </span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 3. Category */}
              <AccordionItem value="category">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.category")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {categories.length > 5 && (
                      <Input
                        placeholder={t("filter.search_categories")}
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                    <ScrollArea className={categories.length > 6 ? "h-[180px]" : ""}>
                      <div className="space-y-2">
                        {filteredCategories.map((cat) => {
                          const catContent = getLocalized(cat.content, locale);
                          return (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={categoryIds.includes(cat.id)}
                                onCheckedChange={() => setCategoryIds(toggleArrayItem(categoryIds, cat.id))}
                              />
                              <span className="text-sm truncate">{catContent.name}</span>
                            </label>
                          );
                        })}
                        {filteredCategories.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">{t("filter.no_results")}</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 4. Supplier */}
              <AccordionItem value="supplier">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.supplier")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {suppliers.length > 5 && (
                      <Input
                        placeholder={t("filter.search_suppliers")}
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                    <ScrollArea className={suppliers.length > 6 ? "h-[180px]" : ""}>
                      <div className="space-y-2">
                        {filteredSuppliers.map((sup) => (
                          <label key={sup.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={supplierIds.includes(sup.id)}
                              onCheckedChange={() => setSupplierIds(toggleArrayItem(supplierIds, sup.id))}
                            />
                            <span className="text-sm truncate">{sup.name}</span>
                          </label>
                        ))}
                        {filteredSuppliers.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">{t("filter.no_results")}</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 5. Price Range */}
              <AccordionItem value="price_range">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.price_range")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <Slider
                      min={0}
                      max={1000}
                      step={10}
                      value={priceRange}
                      onValueChange={(val) => {
                        const [min, max] = val as [number, number];
                        setPriceRange([min, max]);
                        setMinPrice(String(min));
                        setMaxPrice(String(max));
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">{t("filter.min_price")}</label>
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={minPrice}
                          onChange={(e) => {
                            setMinPrice(e.target.value);
                            const val = Number(e.target.value) || 0;
                            setPriceRange([val, priceRange[1]]);
                          }}
                          className="h-8 text-xs"
                          placeholder="€0"
                        />
                      </div>
                      <span className="text-muted-foreground mt-4">–</span>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">{t("filter.max_price")}</label>
                        <Input
                          type="number"
                          min={0}
                          max={10000}
                          value={maxPrice}
                          onChange={(e) => {
                            setMaxPrice(e.target.value);
                            const val = Number(e.target.value) || 1000;
                            setPriceRange([priceRange[0], Math.min(val, 1000)]);
                          }}
                          className="h-8 text-xs"
                          placeholder="€1000"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 6. Stock Status */}
              <AccordionItem value="stock_status">
                <AccordionTrigger className="text-sm font-medium py-3">
                  {t("filter.stock_status")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {(["in_stock", "low_stock", "out_of_stock"] as const).map((ss) => (
                      <label key={ss} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={stockStatuses.includes(ss)}
                          onCheckedChange={() => setStockStatuses(toggleArrayItem(stockStatuses, ss))}
                        />
                        <span className="text-sm">{t(`filter.${ss}`)}</span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ScrollArea>

          <Separator className="my-2" />

          <div className="pt-2 pb-2">
            <Button onClick={applyFilters} className="w-full">
              {t("filter.apply")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 w-full">
          {activeFilters.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-1 text-xs cursor-pointer hover:bg-secondary/80"
              onClick={() => removeChip(chip)}
            >
              {chip.label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
          >
            {t("filter.clear_all")}
          </Button>
        </div>
      )}
    </>
  );
}
