"use client";

import { useCompareStore } from "@/lib/store/compare";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { X, GitCompareArrows, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function CompareBar() {
  const { products, remove, clear } = useCompareStore();
  const router = useRouter();
  const t = useTranslations("compare");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || products.length === 0) return null;

  return (
    <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl shadow-foreground/5">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 shrink-0">
          <GitCompareArrows size={18} className="text-accent" />
          <span className="text-base font-bold text-foreground">
            {t("bar_title")} ({products.length}/4)
          </span>
        </div>

        <div className="flex-1 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-1.5 shrink-0"
            >
              {p.image ? (
                <div className="relative h-8 w-8 shrink-0">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-contain"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="h-8 w-8 bg-secondary rounded shrink-0 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground font-mono">IMG</span>
                </div>
              )}
              <span className="text-sm font-medium text-foreground/80 max-w-[100px] truncate">
                {p.name}
              </span>
              <button
                onClick={() => remove(p.id)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {products.length < 4 &&
            Array.from({ length: 4 - products.length }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-28 border border-dashed border-border rounded-lg shrink-0 hidden sm:flex items-center justify-center"
              >
                <span className="text-sm text-muted-foreground/60">{t("add_product")}</span>
              </div>
            ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={14} />
            {t("clear_all")}
          </button>
          <button
            onClick={() => router.push("/compare")}
            disabled={products.length < 2}
            className={cn(
              "px-4 py-2 rounded-lg text-base font-bold transition-all",
              products.length >= 2
                ? "bg-accent hover:opacity-90 text-accent-foreground"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            {t("compare_now")}
          </button>
        </div>
      </div>
    </div>
  );
}
