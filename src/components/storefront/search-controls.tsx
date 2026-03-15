"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { ProductFilter } from "@/components/storefront/product-filter";
import { Facet } from "@/lib/actions/search";
import { AttributeWithOptions } from "@/lib/actions/attributes";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface SearchControlsProps {
  facets: Record<string, Facet>;
  attributes: AttributeWithOptions[];
  minPrice: number;
  maxPrice: number;
  total?: number;
}

export function SearchControls({
  facets,
  attributes,
  minPrice,
  maxPrice,
  total,
}: SearchControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const tFilter = useTranslations("filter");
  const tSort = useTranslations("sort");

  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
      {/* Mobile Filter Button */}
      <div className="lg:hidden w-full sm:w-auto">
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto gap-2">
              <Filter className="h-4 w-4" />
              {tFilter("title")}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[320px] sm:w-[400px] overflow-y-auto flex flex-col"
          >
            <div className="flex-1 py-4">
              <ProductFilter
                facets={facets}
                attributes={attributes}
                minPrice={minPrice}
                maxPrice={maxPrice}
                showAvailability={true}
                className="block"
              />
            </div>
            <div className="sticky bottom-0 bg-background border-t border-border p-4">
              <Button
                className="w-full"
                onClick={() => setIsFilterOpen(false)}
              >
                {total !== undefined
                  ? tFilter("show_n_results", { count: total })
                  : tFilter("show_results")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-base text-muted-foreground whitespace-nowrap">
          {tSort("label")}
        </span>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tSort("placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{tSort("newest")}</SelectItem>
            <SelectItem value="price_asc">{tSort("price_asc")}</SelectItem>
            <SelectItem value="price_desc">{tSort("price_desc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
