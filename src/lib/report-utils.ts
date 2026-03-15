import { startOfMonth, subMonths, format, eachMonthOfInterval } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Parse from/to search params into a DateRange.
 * Defaults to last 12 months if not provided.
 */
export function parseDateRange(
  searchParams: Record<string, string | string[] | undefined>
): DateRange {
  const now = new Date();
  const fromParam = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const toParam = typeof searchParams.to === "string" ? searchParams.to : undefined;

  const from = fromParam ? new Date(fromParam + "T00:00:00") : startOfMonth(subMonths(now, 11));
  const to = toParam ? new Date(toParam + "T23:59:59.999") : now;

  return { from, to };
}

/**
 * Generate a Map of monthly buckets between from and to dates.
 * Key format: "YYYY-MM"
 */
export function getMonthlyBuckets<T>(from: Date, to: Date, defaultValue: () => T): Map<string, T> {
  const map = new Map<string, T>();
  const months = eachMonthOfInterval({ start: from, end: to });
  for (const month of months) {
    const key = format(month, "yyyy-MM");
    map.set(key, defaultValue());
  }
  return map;
}

/**
 * Get the month key for a date in "YYYY-MM" format
 */
export function getMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

/**
 * Format a number as percentage string
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date range params for URL
 */
export function dateRangeToParams(range: DateRange): string {
  return `from=${format(range.from, "yyyy-MM-dd")}&to=${format(range.to, "yyyy-MM-dd")}`;
}
