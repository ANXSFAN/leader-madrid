"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";

const LOCALE_CONFIG: Record<string, { flag: string; label: string }> = {
  en: { flag: "GB", label: "English" },
  es: { flag: "ES", label: "Espanol" },
  fr: { flag: "FR", label: "Francais" },
  de: { flag: "DE", label: "Deutsch" },
  it: { flag: "IT", label: "Italiano" },
  pt: { flag: "PT", label: "Portugues" },
  nl: { flag: "NL", label: "Nederlands" },
  pl: { flag: "PL", label: "Polski" },
  zh: { flag: "CN", label: "\u4e2d\u6587" },
};

/** Convert country code to flag emoji via regional indicator symbols */
function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function LocaleSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const current = LOCALE_CONFIG[locale] || LOCALE_CONFIG.en;
  const locales = Object.keys(LOCALE_CONFIG);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs hover:text-accent transition-colors px-1.5 py-0.5 rounded"
        aria-label="Language"
      >
        <Globe size={12} className="opacity-70" />
        <span>{countryFlag(current.flag)}</span>
        <span className="hidden sm:inline uppercase font-medium tracking-wide">
          {locale}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-lg shadow-xl py-1 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
          {locales.map((code) => {
            const cfg = LOCALE_CONFIG[code];
            const isActive = code === locale;
            return (
              <button
                key={code}
                onClick={() => {
                  router.replace(pathname, { locale: code });
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-foreground/80 hover:bg-secondary"
                }`}
              >
                <span className="text-base leading-none">
                  {countryFlag(cfg.flag)}
                </span>
                <span className="flex-1 text-left">{cfg.label}</span>
                {isActive && <Check size={14} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
