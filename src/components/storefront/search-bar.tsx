"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2, Clock, ArrowUpRight } from "lucide-react";
import {
  getSearchSuggestions,
  SearchSuggestion,
} from "@/lib/actions/search-suggestions";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchHistory } from "@/hooks/use-search-history";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("query") || "";

  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  // Handle outside click to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await getSearchSuggestions(debouncedQuery, locale);
        setSuggestions(results);
        setIsOpen(true);
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, locale]);

  const handleSearch = (term?: string) => {
    const q = term || query;
    if (!q.trim()) return;

    addToHistory(q.trim());
    setIsOpen(false);
    router.push(`/${locale}/search?query=${encodeURIComponent(q.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    // Show history when input is focused and query is short
    if (query.length < 2 && history.length > 0) {
      setIsOpen(true);
    } else if (query.length >= 2 && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  // Determine what to show in the dropdown
  const showHistory = query.length < 2 && history.length > 0;
  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const showNoResults = query.length >= 2 && !isLoading && suggestions.length === 0;

  return (
    <div ref={wrapperRef} className={cn("relative z-50", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={t("placeholder")}
          className="w-full h-11 pl-4 pr-12 border-2 border-border focus-visible:ring-0 focus-visible:border-accent rounded-lg bg-secondary focus:bg-card transition-all text-foreground placeholder:text-muted-foreground"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />

        {/* Loading / Clear / Search Icons */}
        <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {query && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
              aria-label={t("clear_search")}
            >
              <X size={16} />
            </Button>
          )}

          <Button
            size="sm"
            className="h-9 w-9 bg-accent hover:opacity-90 text-white p-0 rounded-md"
            onClick={() => handleSearch()}
            aria-label={t("search_button")}
          >
            <Search size={18} />
          </Button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (showHistory || showSuggestions || showNoResults) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Recent searches */}
          {showHistory && (
            <div className="py-2">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("recent_searches")}
                </span>
                <button
                  onClick={clearHistory}
                  className="text-sm text-muted-foreground hover:text-red-500 transition-colors"
                >
                  {t("clear_history")}
                </button>
              </div>
              <ul>
                {history.map((term) => (
                  <li key={term} className="flex items-center group">
                    <button
                      className="flex-1 text-left px-4 py-2.5 hover:bg-secondary flex items-center gap-3 transition-colors"
                      onClick={() => {
                        setQuery(term);
                        handleSearch(term);
                      }}
                    >
                      <Clock size={15} className="text-muted-foreground/60 shrink-0" />
                      <span className="text-foreground/80 text-base">{term}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(term);
                        if (history.length <= 1) setIsOpen(false);
                      }}
                      className="pr-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-red-400"
                      aria-label="Remove from history"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Live suggestions */}
          {showSuggestions && (
            <div className="py-2">
              <div className="px-3 py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("suggestions")}
              </div>
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-secondary flex items-center justify-between group transition-colors"
                      onClick={() => {
                        if (suggestion.type === "category") {
                          addToHistory(suggestion.text);
                          router.push(`/${locale}/category/${suggestion.slug}`);
                        } else if (suggestion.type === "product") {
                          addToHistory(suggestion.text);
                          router.push(`/${locale}/product/${suggestion.slug}`);
                        } else {
                          setQuery(suggestion.text);
                          handleSearch(suggestion.text);
                        }
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Search
                          size={15}
                          className="text-muted-foreground/60 group-hover:text-accent transition-colors shrink-0"
                        />
                        <span className="text-foreground/80 text-base font-medium group-hover:text-foreground">
                          {suggestion.text}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground border border-border px-1.5 py-0.5 rounded capitalize shrink-0">
                        {suggestion.type === "category"
                          ? t("category")
                          : t("product")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="p-4 text-center text-muted-foreground text-base">
              {t("no_results")} &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
