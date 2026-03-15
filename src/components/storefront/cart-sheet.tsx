"use client";

import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CartItemRow } from "./cart-item-row";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { updateServerCartItem, removeFromServerCart } from "@/lib/actions/cart";
import { formatMoney } from "@/lib/formatters";
import { convertPrice, type SupportedCurrency } from "@/lib/currency";

export function CartSheet({
  currency = "EUR",
  exchangeRate = 1,
}: {
  currency?: string;
  exchangeRate?: number;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, removeItem, updateQuantity, getTotalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  const fm = (amount: number) =>
    formatMoney(
      convertPrice(amount, currency as SupportedCurrency, exchangeRate),
      { locale, currency }
    );

  useEffect(() => {
    setMounted(true);
  }, []);

  const cartItemCount = mounted ? useCartStore.getState().getTotalItems() : 0;
  const totalPrice = getTotalPrice();

  const handleRemoveItem = async (id: string) => {
    removeItem(id);
    if (session?.user) {
      await removeFromServerCart(id);
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    updateQuantity(id, quantity);
    if (session?.user) {
      await updateServerCartItem(id, quantity);
    }
  };

  if (!mounted) {
    return (
      <button className="p-2 text-foreground/70 hover:text-foreground relative group transition-colors">
        <ShoppingCart size={22} />
      </button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="p-2 text-foreground/70 hover:text-foreground relative group transition-colors">
          <ShoppingCart size={22} />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-card transition-colors">
              {cartItemCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md sm:max-w-md flex flex-col p-0 bg-card h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] rounded-t-xl sm:rounded-none">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> {t("title")} ({cartItemCount}
              )
            </SheetTitle>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-secondary to-muted rounded-full flex items-center justify-center">
                <ShoppingCart className="w-12 h-12 text-muted-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground text-sm font-bold px-2 py-1 rounded-full">
                0
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">{t("empty")}</h3>
              <p className="text-base text-muted-foreground max-w-[250px] mx-auto">
                {t("empty_desc")}
              </p>
            </div>

            <div className="w-full space-y-3 pt-4">
              <div className="bg-secondary rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("explore_categories")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/search"
                    className="text-base text-foreground/80 hover:text-accent py-2 px-3 bg-card rounded-lg border border-border hover:border-accent transition-colors text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    {t("browse_all")}
                  </Link>
                </div>
              </div>

              <SheetClose asChild>
                <Button
                  className="w-full h-12 text-lg bg-accent hover:opacity-90 text-accent-foreground"
                  asChild
                >
                  <Link href="/" onClick={() => setIsOpen(false)}>
                    {t("continue_shopping")}
                  </Link>
                </Button>
              </SheetClose>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="py-6 space-y-6">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveItem}
                    onUpdateQuantity={handleUpdateQuantity}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="border-t bg-secondary p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span className="font-medium">{fm(totalPrice)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("tax_at_checkout")}
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("total")}</span>
                  <span>{fm(totalPrice)}</span>
                </div>
              </div>
              <SheetClose asChild>
                <Button className="w-full h-12 text-lg" asChild>
                  <Link href="/checkout">{t("checkout")}</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/cart">{t("view_cart")}</Link>
                </Button>
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
