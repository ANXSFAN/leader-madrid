import { withAuth } from "next-auth/middleware";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
export type { Locale as SupportedLocale } from "@/i18n/locales";

const LOCALE_PATTERN = new RegExp(
  `^\\/(${SUPPORTED_LOCALES.join("|")})(\\\/|$)`
);

const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES as unknown as string[],
  defaultLocale: "es",
  localePrefix: "always",
});

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isDisabled = token?.disabled === true;

    const pathname = req.nextUrl.pathname;
    const localeMatch = pathname.match(LOCALE_PATTERN);
    const locale = localeMatch ? localeMatch[1] : "es";

    const pathWithoutLocale =
      pathname.replace(new RegExp(`^\\/(${SUPPORTED_LOCALES.join("|")})`), "") || "/";

    const isAuthPage =
      pathWithoutLocale.startsWith("/login") ||
      pathWithoutLocale.startsWith("/register");
    const isAdminPage = pathWithoutLocale.startsWith("/admin");
    const isProfilePage = pathWithoutLocale.startsWith("/profile");

    if (isDisabled && !isAuthPage) {
      return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }

    if (isAdminPage) {
      if (!isAuth) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
      }
      const userRole = token?.role as string;
      const allowedRoles = ["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"];
      if (!allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL(`/${locale}`, req.url));
      }
    }

    if (isProfilePage && !isAuth) {
      return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
