import { getTranslations } from "next-intl/server";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PaymentSuccessPageProps {
  searchParams: Promise<{ orderId?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function PaymentSuccessPage({
  searchParams,
  params,
}: PaymentSuccessPageProps) {
  const { locale } = await params;
  const { orderId } = await searchParams;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return (
    <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h1 className="text-3xl font-bold mb-4">{t("payment_success_title")}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        {t("payment_success_desc")}
      </p>
      <div className="flex gap-4">
        {orderId && (
          <Button asChild>
            <Link href={`/${locale}/profile/orders`}>
              {t("view_orders")}
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/${locale}`}>{t("back_to_shop")}</Link>
        </Button>
      </div>
    </div>
  );
}
