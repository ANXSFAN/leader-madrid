import db from "@/lib/db";
import {
  SUPPORTED_CURRENCIES,
  BASE_CURRENCY,
  convertPrice,
  convertToEUR,
  type SupportedCurrency,
} from "@/lib/currency";

// --- In-memory cache (5-min TTL) ---

interface CacheEntry {
  rate: number;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const rateCache = new Map<string, CacheEntry>();

function getCached(currency: string): number | null {
  const entry = rateCache.get(currency);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.rate;
  }
  rateCache.delete(currency);
  return null;
}

function setCache(currency: string, rate: number): void {
  rateCache.set(currency, {
    rate,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// --- ECB XML Fetcher ---

const ECB_DAILY_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/**
 * Fetch latest rates from ECB and store in DB.
 * Does NOT overwrite records where isManualOverride=true for the same date.
 */
export async function fetchECBRates(): Promise<{
  updated: string[];
  skipped: string[];
  errors: string[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(ECB_DAILY_URL, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(`ECB fetch failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Parse XML - extract <Cube currency="XXX" rate="1.2345"/> entries
  const cubeRegex = /<Cube\s+currency='([A-Z]+)'\s+rate='([\d.]+)'\s*\/>/g;
  const timeRegex = /<Cube\s+time='(\d{4}-\d{2}-\d{2})'/;

  const timeMatch = timeRegex.exec(xml);
  if (!timeMatch) {
    throw new Error("Could not parse ECB date from XML");
  }
  const dateStr = timeMatch[1];
  const date = new Date(dateStr + "T00:00:00Z");

  const targetCurrencies = new Set(
    SUPPORTED_CURRENCIES.filter((c) => c !== BASE_CURRENCY)
  );

  const parsed: { currency: string; rate: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = cubeRegex.exec(xml)) !== null) {
    const [, currency, rateStr] = match;
    if (targetCurrencies.has(currency as SupportedCurrency)) {
      parsed.push({ currency, rate: parseFloat(rateStr) });
    }
  }

  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const { currency, rate } of parsed) {
    try {
      // Check if a manual override exists for this currency+date
      const existing = await db.exchangeRate.findUnique({
        where: { currency_date: { currency, date } },
      });

      if (existing?.isManualOverride) {
        skipped.push(currency);
        continue;
      }

      await db.exchangeRate.upsert({
        where: { currency_date: { currency, date } },
        update: {
          rate,
          source: "ECB",
          isManualOverride: false,
        },
        create: {
          currency,
          rate,
          source: "ECB",
          date,
          isManualOverride: false,
        },
      });

      // Invalidate cache
      rateCache.delete(currency);
      updated.push(currency);
    } catch (err) {
      errors.push(`${currency}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Also set EUR = 1.0 for consistency
  setCache(BASE_CURRENCY, 1.0);

  return { updated, skipped, errors };
}

// --- Rate Queries ---

/**
 * Get the latest exchange rate for a currency (1 EUR = X target).
 * Returns 1.0 for EUR.
 */
export async function getExchangeRate(
  currency: SupportedCurrency
): Promise<number> {
  if (currency === BASE_CURRENCY) return 1.0;

  const cached = getCached(currency);
  if (cached !== null) return cached;

  const record = await db.exchangeRate.findFirst({
    where: { currency },
    orderBy: { date: "desc" },
  });

  if (!record) {
    // No rate in DB yet - return 1.0 as safe fallback
    return 1.0;
  }

  const rate = Number(record.rate);
  setCache(currency, rate);
  return rate;
}

/**
 * Get all current rates for enabled currencies.
 */
export async function getAllCurrentRates(): Promise<
  Record<string, { rate: number; source: string; date: Date; isManualOverride: boolean }>
> {
  const currencies = SUPPORTED_CURRENCIES.filter((c) => c !== BASE_CURRENCY);

  const results: Record<
    string,
    { rate: number; source: string; date: Date; isManualOverride: boolean }
  > = {};

  // EUR is always 1
  results[BASE_CURRENCY] = {
    rate: 1.0,
    source: "BASE",
    date: new Date(),
    isManualOverride: false,
  };

  // Fetch latest rate per currency using raw query for efficiency
  for (const currency of currencies) {
    const record = await db.exchangeRate.findFirst({
      where: { currency },
      orderBy: { date: "desc" },
    });

    if (record) {
      results[currency] = {
        rate: Number(record.rate),
        source: record.source,
        date: record.date,
        isManualOverride: record.isManualOverride,
      };
      setCache(currency, Number(record.rate));
    }
  }

  return results;
}

// Re-export pure conversion functions from currency.ts
export { convertPrice, convertToEUR };

/**
 * Set manual exchange rate override for a currency.
 */
export async function setManualRate(
  currency: SupportedCurrency,
  rate: number
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.exchangeRate.upsert({
    where: { currency_date: { currency, date: today } },
    update: {
      rate,
      source: "MANUAL",
      isManualOverride: true,
    },
    create: {
      currency,
      rate,
      source: "MANUAL",
      date: today,
      isManualOverride: true,
    },
  });

  // Invalidate cache
  rateCache.delete(currency);
}

/**
 * Remove manual override, reverting to the latest ECB rate.
 */
export async function removeManualOverride(
  currency: SupportedCurrency
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Delete today's manual override if it exists
  await db.exchangeRate.deleteMany({
    where: {
      currency,
      date: today,
      isManualOverride: true,
    },
  });

  // Invalidate cache so next read picks up the latest ECB rate
  rateCache.delete(currency);
}
