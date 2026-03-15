import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import CheckoutForm from "@/components/storefront/checkout-form";
import { getSiteSettings } from "@/lib/actions/config";
import { getActiveShippingMethods } from "@/lib/actions/shipping";
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
  const t = await getTranslations({ locale: params.locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=/${params.locale}/checkout`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      b2bStatus: true,
      taxId: true,
      registrationCountry: true,
    },
  });

  const [addresses, settings, shippingMethods, displayCurrency] = await Promise.all([
    db.address.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    getSiteSettings(),
    getActiveShippingMethods(),
    resolveDisplayCurrency(params.locale),
  ]);

  // Snapshot exchange rate at checkout page load
  const exchangeRate =
    displayCurrency !== BASE_CURRENCY
      ? await getExchangeRate(displayCurrency)
      : 1;

  const safeShippingMethods = shippingMethods.map((method) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    price: method.price,
    estimatedDays: method.estimatedDays,
    isDefault: method.isDefault,
  }));

  return (
    <CheckoutForm
      user={user}
      addresses={addresses}
      currency={displayCurrency}
      exchangeRate={exchangeRate}
      shippingMethods={safeShippingMethods}
    />
  );
}
