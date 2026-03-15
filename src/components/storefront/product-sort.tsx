"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";

export function ProductSort() {
  const t = useTranslations("sort");
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);

    // Reset to page 1 when sorting changes
    params.set("page", "1");

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-base text-muted-foreground hidden sm:inline">
        {t("label")}
      </span>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{t("newest")}</SelectItem>
          <SelectItem value="price_asc">{t("price_asc")}</SelectItem>
          <SelectItem value="price_desc">{t("price_desc")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
