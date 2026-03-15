import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./locales";
import type { Locale } from "./locales";

export { SUPPORTED_LOCALES };
export type { Locale };

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (
      typeof bv === "object" && bv !== null && !Array.isArray(bv) &&
      typeof ov === "object" && ov !== null && !Array.isArray(ov)
    ) {
      result[key] = deepMerge(bv as Messages, ov as Messages);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!locale || !SUPPORTED_LOCALES.includes(locale as Locale)) {
    notFound();
  }

  const enMessages: Messages = await import(`../../messages/${DEFAULT_LOCALE}.json`)
    .then((m) => m.default as Messages)
    .catch(() => ({} as Messages));

  const localeMessages: Messages =
    locale === DEFAULT_LOCALE
      ? {}
      : await import(`../../messages/${locale}.json`)
          .then((m) => m.default as Messages)
          .catch(() => ({} as Messages));

  const messages = locale === DEFAULT_LOCALE
    ? enMessages
    : deepMerge(enMessages, localeMessages);

  return { locale: locale as string, messages };
});
