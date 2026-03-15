import { CompareContent } from "./compare-content";
import { getTranslations } from "next-intl/server";
import { resolveDisplayCurrency } from "@/lib/currency.server";
import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "compare" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ComparePage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const displayCurrency = await resolveDisplayCurrency(params.locale);
  return <CompareContent currency={displayCurrency} />;
}
