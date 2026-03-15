/**
 * Translates an enum code using a translation namespace's `t` function.
 * Falls back to `code` itself if the translation is missing or empty.
 *
 * @example
 * // Server component
 * const t = await getTranslations("orders");
 * labelCode(t, "status", order.status); // "Pending" or "PENDING" if missing
 *
 * // Client component
 * const t = useTranslations("returns");
 * labelCode(t, "reason", item.reason);
 */
export function labelCode(
  t: (key: string) => string,
  prefix: string,
  code: string
): string {
  const result = (t as (k: string) => string)(`${prefix}.${code}`);
  if (!result || result.startsWith("[MISSING]")) return code;
  return result;
}
