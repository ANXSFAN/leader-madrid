"use client";

import { useState, useEffect } from "react";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { Trash2, Minus, Plus } from "lucide-react";
import { CartItem } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { formatMoney } from "@/lib/formatters";

interface CartPageItemProps {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  currency?: string;
}

export function CartPageItem({
  item,
  onRemove,
  onUpdateQuantity,
  currency = "EUR",
}: CartPageItemProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [quantity, setQuantity] = useState(item.quantity);
  const debouncedQuantity = useDebounce(quantity, 300);

  // Sync local state if item.quantity changes from outside
  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  // Sync back to store when debounced value changes
  useEffect(() => {
    if (debouncedQuantity !== item.quantity) {
      onUpdateQuantity(item.id, debouncedQuantity);
    }
  }, [debouncedQuantity, item.id, item.quantity, onUpdateQuantity]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex flex-wrap gap-4 items-center">
        <div className="w-20 h-20 rounded-md border bg-muted overflow-hidden flex-shrink-0">
          <ProductThumbnail
            src={item.image}
            alt={item.name}
            width={80}
            height={80}
            className="w-full h-full"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
          <p className="text-base text-muted-foreground mb-1">
            {t("sku")}: {item.id.split("-").pop()}
          </p>
          <div className="font-medium text-foreground">
            {formatMoney(item.price, { locale, currency })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-base font-medium">
              {quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setQuantity(Math.min(item.maxStock, quantity + 1))}
              disabled={quantity >= item.maxStock}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
