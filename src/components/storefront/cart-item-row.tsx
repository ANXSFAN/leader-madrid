"use client";

import { useState, useEffect } from "react";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { X, Minus, Plus } from "lucide-react";
import { CartItem } from "@/lib/store/cart";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface CartItemRowProps {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}

export function CartItemRow({
  item,
  onRemove,
  onUpdateQuantity,
}: CartItemRowProps) {
  const t = useTranslations("common");
  const [quantity, setQuantity] = useState(item.quantity);
  const debouncedQuantity = useDebounce(quantity, 300);

  // Sync local state if item.quantity changes from outside (rare but possible)
  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  // Sync back to store when debounced value changes
  useEffect(() => {
    if (debouncedQuantity !== item.quantity) {
      onUpdateQuantity(item.id, debouncedQuantity);
    }
  }, [debouncedQuantity, item.id, item.quantity, onUpdateQuantity]);

  const handleIncrement = () => {
    if (quantity < item.maxStock) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  return (
    <div className="flex gap-4 group">
      <div className="w-20 h-20 rounded-md border bg-muted overflow-hidden flex-shrink-0 relative">
        <ProductThumbnail
          src={item.image}
          alt={item.name}
          width={80}
          height={80}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-base font-medium leading-tight line-clamp-2 text-foreground">
              {item.name}
            </h4>
            <button
              onClick={() => onRemove(item.id)}
              className="text-muted-foreground hover:text-red-500 transition-colors p-1 -mr-2 -mt-1"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {t("sku")}: {item.id.split("-").pop()}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center border rounded-md h-8 bg-white">
            <button
              className="px-2 h-full hover:bg-muted text-muted-foreground disabled:opacity-50"
              onClick={handleDecrement}
              disabled={quantity <= 1}
            >
              <Minus size={12} />
            </button>
            <span className="w-8 text-center text-sm font-medium">
              {quantity}
            </span>
            <button
              className="px-2 h-full hover:bg-muted text-muted-foreground disabled:opacity-50"
              onClick={handleIncrement}
              disabled={quantity >= item.maxStock}
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="font-semibold text-base">
            €{(item.price * quantity).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
