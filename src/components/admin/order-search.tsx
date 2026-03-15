"use client";

import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";

export function OrderSearch() {
  const router = useRouter();
  const t = useTranslations("admin.orders");
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");
  const debouncedValue = useDebounce(value, 300);
  const [isPending, startTransition] = useTransition();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedValue) {
        params.set("q", debouncedValue);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
        params.set("page", "1");
        router.push(`?${params.toString()}`);
      });
    }
  };

  const handleClear = () => {
    setValue("");
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("q");
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="relative flex-1 max-w-sm">
      {isPending ? (
        <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 animate-spin" />
      ) : (
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
      )}
      <Input
        placeholder={t("search_placeholder")}
        className="pl-8 pr-8 bg-white"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
          onClick={handleClear}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear</span>
        </Button>
      )}
    </div>
  );
}
