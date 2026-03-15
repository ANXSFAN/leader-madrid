"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  CURRENCY_COOKIE,
  type SupportedCurrency,
} from "@/lib/currency";

interface CurrencySelectorProps {
  currentCurrency: SupportedCurrency;
  enabledCurrencies?: SupportedCurrency[];
}

export function CurrencySelector({
  currentCurrency,
  enabledCurrencies,
}: CurrencySelectorProps) {
  const router = useRouter();
  const t = useTranslations("currency");

  const currencies = enabledCurrencies || [...SUPPORTED_CURRENCIES];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as SupportedCurrency;

    // Set cookie (365 days)
    document.cookie = `${CURRENCY_COOKIE}=${value};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;

    // Trigger server re-render
    router.refresh();
  }

  return (
    <select
      value={currentCurrency}
      onChange={handleChange}
      aria-label={t("selector_label")}
      className="bg-transparent text-xs border border-border/50 rounded px-1.5 py-0.5 cursor-pointer hover:border-accent focus:outline-none focus:border-accent transition-colors"
    >
      {currencies.map((code) => {
        const info = CURRENCY_INFO[code];
        return (
          <option key={code} value={code}>
            {info.symbol} {code}
          </option>
        );
      })}
    </select>
  );
}
