"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Clock, ChevronRight, X, Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchHistory } from "@/hooks/use-search-history";
import {
  getSearchSuggestions,
  getFeaturedSearchTerms,
  type SearchSuggestion,
  type FeaturedSearchTerm,
} from "@/lib/actions/search-suggestions";
import { cn } from "@/lib/utils";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [featured, setFeatured] = useState<FeaturedSearchTerm[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  // Auto-focus input when overlay opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setSuggestions([]);
    }
  }, [open]);

  // Load featured products
  useEffect(() => {
    if (open) {
      getFeaturedSearchTerms(locale).then(setFeatured).catch(() => {});
    }
  }, [open, locale]);

  // Fetch suggestions on debounced query
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    getSearchSuggestions(debouncedQuery, locale)
      .then((results) => {
        if (!cancelled) setSuggestions(results);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, locale]);

  const handleSearch = useCallback(
    (term?: string) => {
      const q = (term || query).trim();
      if (!q) return;
      addToHistory(q);
      onClose();
      router.push(`/${locale}/search?query=${encodeURIComponent(q)}`);
    },
    [query, addToHistory, onClose, router, locale]
  );

  const handleProductClick = useCallback(
    (slug: string, name: string) => {
      addToHistory(name);
      onClose();
      router.push(`/${locale}/product/${slug}`);
    },
    [addToHistory, onClose, router, locale]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "category") {
        addToHistory(suggestion.text);
        onClose();
        router.push(`/${locale}/category/${suggestion.slug}`);
      } else if (suggestion.type === "product") {
        addToHistory(suggestion.text);
        onClose();
        router.push(`/${locale}/product/${suggestion.slug}`);
      } else {
        handleSearch(suggestion.text);
      }
    },
    [addToHistory, onClose, router, locale, handleSearch]
  );

  if (!open) return null;

  const showContent = query.length < 2;
  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const showNoResults = query.length >= 2 && !isLoading && suggestions.length === 0 && debouncedQuery.length >= 2;

  return (
    <div className="fixed inset-0 z-[60] bg-background lg:hidden flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder={t("placeholder")}
            className="w-full h-10 pl-9 pr-9 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          onClick={() => handleSearch()}
          className="text-sm font-medium text-accent hover:text-accent/80 transition-colors shrink-0 px-1"
        >
          {t("search_action")}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading indicator */}
        {isLoading && query.length >= 2 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Default content: recent searches + hot picks */}
        {showContent && (
          <div className="px-4 py-4 space-y-6">
            {/* Recent Searches */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {t("recent_searches")}
                    </span>
                  </div>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    {t("clear_history")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full text-sm text-foreground/80 transition-colors"
                    >
                      <Clock size={12} className="text-muted-foreground/60" />
                      <span>{term}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(term);
                        }}
                        className="ml-0.5 text-muted-foreground/40 hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hot Picks */}
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-foreground">
                    🔥 {t("hot_recommendations")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {featured.map((item) => (
                    <button
                      key={item.slug}
                      onClick={() => handleProductClick(item.slug, item.name)}
                      className="flex items-center justify-between px-3 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors group"
                    >
                      <span className="text-sm text-foreground/80 group-hover:text-foreground truncate mr-2">
                        {item.name}
                      </span>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/40 group-hover:text-accent shrink-0 transition-colors"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Suggestions */}
        {showSuggestions && !isLoading && (
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("suggestions")}
            </div>
            <ul>
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-secondary flex items-center justify-between transition-colors active:bg-secondary/80"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Search
                        size={15}
                        className="text-muted-foreground/60 shrink-0"
                      />
                      <span className="text-sm text-foreground/80 truncate">
                        {suggestion.text}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded capitalize shrink-0 ml-2">
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

        {/* No Results */}
        {showNoResults && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {t("no_results")} &quot;{debouncedQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
