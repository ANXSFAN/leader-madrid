"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from "lucide-react";
import { addBatchToServerCart } from "@/lib/actions/cart";
import { toast } from "sonner";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface OrderBuyAgainButtonProps {
  items: {
    variantId: string;
    quantity: number;
  }[];
}

export function OrderBuyAgainButton({ items }: OrderBuyAgainButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("orders");

  const handleBuyAgain = () => {
    startTransition(async () => {
      try {
        await addBatchToServerCart(items);
        toast.success(t("buy_again_success"));
        router.push("/cart");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error(t("buy_again_error"));
      }
    });
  };

  return (
    <Button
      onClick={handleBuyAgain}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      {t("buy_again")}
    </Button>
  );
}
