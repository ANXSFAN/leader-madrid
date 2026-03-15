"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { format, startOfMonth, startOfYear, subMonths } from "date-fns";

type PresetKey = "this_month" | "last_month" | "3_months" | "6_months" | "12_months" | "this_year" | "custom";

function getPresetRange(key: PresetKey): { from: string; to: string } | null {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  switch (key) {
    case "this_month":
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: today };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return {
        from: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        to: format(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0), "yyyy-MM-dd"),
      };
    }
    case "3_months":
      return { from: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"), to: today };
    case "6_months":
      return { from: format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"), to: today };
    case "12_months":
      return { from: format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd"), to: today };
    case "this_year":
      return { from: format(startOfYear(now), "yyyy-MM-dd"), to: today };
    default:
      return null;
  }
}

export function DateRangePicker() {
  const t = useTranslations("admin.reports.date_range");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const [isCustom, setIsCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);

  function applyRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handlePreset(key: PresetKey) {
    if (key === "custom") {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    const range = getPresetRange(key);
    if (range) applyRange(range.from, range.to);
  }

  function handleCustomApply() {
    if (customFrom && customTo) {
      applyRange(customFrom, customTo);
    }
  }

  const presets: { key: PresetKey; label: string }[] = [
    { key: "this_month", label: t("this_month") },
    { key: "last_month", label: t("last_month") },
    { key: "3_months", label: t("3_months") },
    { key: "6_months", label: t("6_months") },
    { key: "12_months", label: t("12_months") },
    { key: "this_year", label: t("this_year") },
    { key: "custom", label: t("custom") },
  ];

  // Detect which preset is active
  const activePreset = (() => {
    for (const p of presets) {
      if (p.key === "custom") continue;
      const range = getPresetRange(p.key);
      if (range && range.from === currentFrom && range.to === currentTo) return p.key;
    }
    if (currentFrom || currentTo) return "custom" as PresetKey;
    return "12_months" as PresetKey; // default
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.key}
          variant={activePreset === p.key ? "default" : "outline"}
          size="sm"
          className="text-xs h-7"
          onClick={() => handlePreset(p.key)}
        >
          {p.label}
        </Button>
      ))}

      {(isCustom || activePreset === "custom") && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs h-7"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs h-7"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
          <Button size="sm" className="text-xs h-7" onClick={handleCustomApply}>
            {t("apply")}
          </Button>
        </div>
      )}
    </div>
  );
}
