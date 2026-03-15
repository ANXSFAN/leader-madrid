import { useCallback, useEffect, useState } from "react";

const HISTORY_KEY = "zelura_search_history";
const MAX_ITEMS = 6;

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  // Load from localStorage once on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {}
  }, []);

  const addToHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((term: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
    setHistory([]);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
