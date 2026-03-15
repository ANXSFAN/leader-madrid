export const SUPPORTED_CURRENCIES = [
  "EUR",
  "GBP",
  "PLN",
  "SEK",
  "DKK",
  "CZK",
  "CHF",
  "NOK",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY: SupportedCurrency = "EUR";

export const LOCALE_CURRENCY_MAP: Record<string, SupportedCurrency> = {
  en: "GBP",
  es: "EUR",
  fr: "EUR",
  de: "EUR",
  it: "EUR",
  pt: "EUR",
  nl: "EUR",
  pl: "PLN",
  zh: "EUR",
};

export const CURRENCY_INFO: Record<
  SupportedCurrency,
  { symbol: string; nameKey: string }
> = {
  EUR: { symbol: "€", nameKey: "currency.eur" },
  GBP: { symbol: "£", nameKey: "currency.gbp" },
  PLN: { symbol: "zł", nameKey: "currency.pln" },
  SEK: { symbol: "kr", nameKey: "currency.sek" },
  DKK: { symbol: "kr", nameKey: "currency.dkk" },
  CZK: { symbol: "Kč", nameKey: "currency.czk" },
  CHF: { symbol: "Fr", nameKey: "currency.chf" },
  NOK: { symbol: "kr", nameKey: "currency.nok" },
};

export const CURRENCY_COOKIE = "preferred-currency";

/**
 * Check if a string is a valid supported currency.
 */
export function isSupportedCurrency(
  value: string
): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);
}

// --- Pure conversion functions (safe for client components) ---

/**
 * Convert EUR amount to target currency, rounding to 2 decimal places.
 */
export function convertPrice(
  amountEUR: number,
  targetCurrency: SupportedCurrency | string,
  rate: number
): number {
  if (targetCurrency === BASE_CURRENCY) return amountEUR;
  return Math.round(amountEUR * rate * 100) / 100;
}

/**
 * Convert from a foreign currency back to EUR.
 */
export function convertToEUR(
  amount: number,
  sourceCurrency: SupportedCurrency | string,
  rate: number
): number {
  if (sourceCurrency === BASE_CURRENCY) return amount;
  if (rate === 0) return amount;
  return Math.round((amount / rate) * 100) / 100;
}
