"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface VATDetermination {
  vatLabel: string;
  vatLabelEs: string;
  vatAmount: number;
  isReverseCharge: boolean;
  isExempt: boolean;
}

interface CheckoutOrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  tax: number;
  shippingCost: number;
  total: number;
  isSubmitting: boolean;
  vatDetermination: VATDetermination;
  fm: (amount: number) => string;
  t: (key: string) => string;
}

export function CheckoutOrderSummary({
  items,
  totalPrice,
  tax,
  shippingCost,
  total,
  isSubmitting,
  vatDetermination,
  fm,
  t,
}: CheckoutOrderSummaryProps) {
  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>{t("order_summary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-base">
              <span className="text-muted-foreground">
                {item.name} x {item.quantity}
              </span>
              <span className="font-medium">
                {fm(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span>{fm(totalPrice)}</span>
          </div>

          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">
              {vatDetermination.vatLabel}
            </span>
            <span
              className={
                vatDetermination.isReverseCharge || vatDetermination.isExempt
                  ? "text-green-600 font-medium"
                  : ""
              }
            >
              {vatDetermination.isReverseCharge || vatDetermination.isExempt
                ? fm(0)
                : fm(tax)}
            </span>
          </div>

          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">{t("shipping")}</span>
            <span>{fm(shippingCost)}</span>
          </div>

          {(vatDetermination.isReverseCharge || vatDetermination.isExempt) && (
            <div className="flex items-start gap-2 p-2 bg-accent/10 rounded text-sm text-accent">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                {vatDetermination.isReverseCharge
                  ? t("reverse_charge_notice")
                  : t("export_vat_notice")}
              </span>
            </div>
          )}

          <Separator />
          <div className="flex justify-between font-bold text-xl">
            <span>{t("total")}</span>
            <span>{fm(total)}</span>
          </div>
          {(vatDetermination.isReverseCharge || vatDetermination.isExempt) && (
            <p className="text-sm text-muted-foreground">{t("vat_exempt_total")}</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("processing")}
            </>
          ) : (
            t("confirm_order")
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
