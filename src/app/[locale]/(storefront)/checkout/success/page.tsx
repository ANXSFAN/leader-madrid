import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ orderNumber?: string; orderId?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function OrderSuccessPage(props: Props) {
  const params = await props.params;

  const {
    locale
  } = params;

  const searchParams = await props.searchParams;
  const t = await getTranslations("checkout_success");
  const { orderNumber, orderId } = searchParams;

  return (
    <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center min-h-[60vh]">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        {orderNumber
          ? t("desc", { number: `#${orderNumber}` })
          : t("desc_no_number")}
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/">{t("continue_shopping")}</Link>
        </Button>
        {orderId ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/profile/orders/${orderId}`}>{t("view_order")}</Link>
          </Button>
        ) : (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/profile">{t("view_orders")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
