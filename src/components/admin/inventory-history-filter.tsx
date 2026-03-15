"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

export function InventoryHistoryFilter() {
  const t = useTranslations("admin.inventory.history");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");

  const currentType = searchParams.get("type") || "ALL";

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateParams("q", searchValue);
    }
  };

  const updateParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset page on filter change
    params.set("page", "1");

    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          placeholder={t("search_placeholder")}
          className="pl-8 bg-white"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>

      <div className="w-[200px]">
        <Select
          value={currentType}
          onValueChange={(val) => updateParams("type", val)}
        >
          <SelectTrigger className="bg-white">
            <SelectValue placeholder={t("filter_by_type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("all_types")}</SelectItem>
            <SelectItem value="PURCHASE_ORDER">{t("type_purchase_order")}</SelectItem>
            <SelectItem value="SALE_ORDER">{t("type_sale_order")}</SelectItem>
            <SelectItem value="ADJUSTMENT">{t("type_adjustment")}</SelectItem>
            <SelectItem value="RETURN">{t("type_return")}</SelectItem>
            <SelectItem value="DAMAGED">{t("type_damaged")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
