import { CartContent } from "./cart-content";
import { getTranslations } from "next-intl/server";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import { BASE_CURRENCY } from "@/lib/currency";
import { getExchangeRate } from "@/lib/services/exchange-rate-service";
import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "cart" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    locale
  } = params;

  const displayCurrency = await resolveDisplayCurrency(locale);
  const exchangeRate =
    displayCurrency !== BASE_CURRENCY
      ? await getExchangeRate(displayCurrency)
      : 1;

  return (
    <CartContent
      currency={displayCurrency}
      locale={locale}
      exchangeRate={exchangeRate}
    />
  );
}
