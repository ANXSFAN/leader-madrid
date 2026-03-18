"use client";

import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TAX_NAME } from "@/lib/config";
import { TAX_RATES } from "@/lib/tax";
import {
  refreshCartPrices,
  updateServerCartItem,
  removeFromServerCart,
} from "@/lib/actions/cart";
import { useTranslations } from "next-intl";
import { CartPageItem } from "@/components/storefront/cart-page-item";
import { useSession } from "next-auth/react";
import { formatMoney } from "@/lib/formatters";
import { convertPrice, type SupportedCurrency } from "@/lib/currency";

interface CartContentProps {
  currency: string;
  locale: string;
  exchangeRate?: number;
}

export function CartContent({ currency, locale, exchangeRate = 1 }: CartContentProps) {
  const t = useTranslations("cart");
  const { data: session } = useSession();
  const {
    items,
    removeItem,
    updateQuantity,
    updatePrice,
    getTotalPrice,
    clearCart,
  } = useCartStore();
  const totalPrice = getTotalPrice();
  const estimatedTaxRate = TAX_RATES.ES;

  const cartItemsKey = JSON.stringify(
    items.map((i) => ({ id: i.id, q: i.quantity }))
  );
  const lastProcessedKey = useRef<string>("");

  const fm = (amount: number) =>
    formatMoney(
      convertPrice(amount, currency as SupportedCurrency, exchangeRate),
      { locale, currency }
    );

  const handleRemoveItem = async (id: string) => {
    removeItem(id);
    if (session?.user) await removeFromServerCart(id);
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    updateQuantity(id, quantity);
    if (session?.user) await updateServerCartItem(id, quantity);
  };

  useEffect(() => {
    const validatePrices = async () => {
      if (cartItemsKey === lastProcessedKey.current) return;
      lastProcessedKey.current = cartItemsKey;
      if (items.length === 0) return;
      const payload = items.map((i) => ({ id: i.id, quantity: i.quantity }));
      try {
        const priceMap = await refreshCartPrices(payload);
        Object.entries(priceMap).forEach(([id, price]) => {
          const item = items.find((i) => i.id === id);
          if (item && Math.abs(item.price - price) > 0.001) updatePrice(id, price);
        });
      } catch (error) {
        console.error("Failed to refresh cart prices", error);
      }
    };
    validatePrices();
  }, [cartItemsKey, items, updatePrice]);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingCart className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{t("empty")}</h1>
        <p className="text-muted-foreground mb-8 max-w-md">{t("empty_desc")}</p>
        <Button asChild size="lg">
          <Link href="/">{t("continue_shopping")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-3">
        <ShoppingCart className="w-8 h-8" /> {t("title")}
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartPageItem
              key={item.id}
              item={item}
              onRemove={handleRemoveItem}
              onUpdateQuantity={handleUpdateQuantity}
            />
          ))}
          <div className="flex justify-end mt-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> {t("clear_cart")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("clear_cart")}</DialogTitle>
                  <DialogDescription>
                    {t("clear_cart_confirm")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogTrigger asChild>
                    <Button variant="outline">{t("cancel")}</Button>
                  </DialogTrigger>
                  <DialogTrigger asChild>
                    <Button variant="destructive" onClick={clearCart}>
                      {t("clear_cart")}
                    </Button>
                  </DialogTrigger>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>{t("summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-medium">{fm(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("tax")} ({TAX_NAME} {(estimatedTaxRate * 100).toFixed(0)}%)
                </span>
                <span className="font-medium">{fm(totalPrice * estimatedTaxRate)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total")}</span>
                <span>{fm(totalPrice * (1 + estimatedTaxRate))}</span>
              </div>
              <Button className="w-full h-12 text-base mt-4" asChild>
                <Link href="/checkout">
                  {t("checkout")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {t("shipping_calculated")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
