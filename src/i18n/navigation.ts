import { createNavigation } from "next-intl/navigation";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./locales";

export const { Link, redirect, useRouter, usePathname } = createNavigation({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
