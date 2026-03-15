export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
