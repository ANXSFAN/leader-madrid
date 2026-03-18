import db from "@/lib/db";
import { Navbar } from "@/components/storefront/navbar";
import { Footer } from "@/components/storefront/footer";
import { getSiteSettings, getGlobalConfig } from "@/lib/actions/config";
import { CartSync } from "@/components/cart-sync";
import { BottomNavigation } from "@/components/storefront/bottom-navigation";
import { CompareBar } from "@/components/storefront/compare-bar";
import { CookieConsent } from "@/components/storefront/cookie-consent";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import type { MegaMenuData } from "@/lib/types/mega-menu";
import { SUPPORTED_CURRENCIES, BASE_CURRENCY, type SupportedCurrency } from "@/lib/currency";
import { getExchangeRate } from "@/lib/services/exchange-rate-service";

async function getCategories() {
  return await db.category.findMany({
    where: { parentId: null },
    include: {
      children: {
        include: {
          children: true,
        },
      },
    },
  });
}

export default async function StorefrontLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const { locale } = params;
  const [categories, settings, megaSolutions, megaResources, currencyConfig] = await Promise.all([
    getCategories(),
    getSiteSettings(),
    getGlobalConfig("mega_menu_solutions"),
    getGlobalConfig("mega_menu_resources"),
    getGlobalConfig("currency_config"),
  ]);

  const displayCurrency = await resolveDisplayCurrency(locale);
  const enabledCurrencies = (currencyConfig as Record<string, unknown> | null)?.enabledCurrencies as SupportedCurrency[] || [...SUPPORTED_CURRENCIES];
  const exchangeRate =
    displayCurrency !== BASE_CURRENCY
      ? await getExchangeRate(displayCurrency)
      : 1;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <CartSync />
      <Navbar
        categories={categories}
        settings={settings}
        megaMenuSolutions={megaSolutions as MegaMenuData | null}
        megaMenuResources={megaResources as MegaMenuData | null}
        displayCurrency={displayCurrency}
        enabledCurrencies={enabledCurrencies}
        exchangeRate={exchangeRate}
      />
      <div className="flex-grow pb-16 lg:pb-0">{children}</div>
      <Footer />
      <BottomNavigation />
      <CompareBar />
      <CookieConsent />
      <WhatsAppButton />
    </div>
  );
}
