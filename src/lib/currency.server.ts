import { cookies } from "next/headers";
import {
  SUPPORTED_CURRENCIES,
  LOCALE_CURRENCY_MAP,
  BASE_CURRENCY,
  CURRENCY_COOKIE,
  type SupportedCurrency,
} from "@/lib/currency";

/**
 * Server-side only: resolve the display currency for the current request.
 * Priority: cookie > locale mapping > EUR fallback
 */
export async function resolveDisplayCurrency(
  locale: string
): Promise<SupportedCurrency> {
  try {
    const cookieStore = await cookies();
    const preferred = cookieStore.get(CURRENCY_COOKIE)?.value;
    if (
      preferred &&
      SUPPORTED_CURRENCIES.includes(preferred as SupportedCurrency)
    ) {
      return preferred as SupportedCurrency;
    }
  } catch {
    // cookies() may throw in certain contexts (e.g. generateMetadata)
  }

  return LOCALE_CURRENCY_MAP[locale] || BASE_CURRENCY;
}
