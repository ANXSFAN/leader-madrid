"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleWishlistItem } from "@/lib/actions/wishlist";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: string;
  initialIsInWishlist?: boolean;
  variant?: "default" | "icon";
  className?: string;
}

export function WishlistButton({
  productId,
  initialIsInWishlist = false,
  variant = "default",
  className,
}: WishlistButtonProps) {
  const t = useTranslations("product");
  const { data: session } = useSession();
  const router = useRouter();
  const [isInWishlist, setIsInWishlist] = useState(initialIsInWishlist);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!session?.user) {
      toast.error(t("login_required"));
      router.push("/login");
      return;
    }

    startTransition(async () => {
      const result = await toggleWishlistItem(productId);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      if (result && "added" in result) {
        setIsInWishlist(result.added);
        if (result.added) {
          toast.success(t("added_to_wishlist"));
        } else {
          toast.success(t("removed_from_wishlist"));
        }
      }
    });
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "p-4 border-2 border-border rounded-xl text-muted-foreground hover:text-red-500 hover:border-red-100 transition-all disabled:opacity-50",
          isInWishlist && "text-red-500 border-red-100",
          className
        )}
      >
        <Heart
          size={20}
          className={cn(isInWishlist && "fill-red-500")}
        />
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      className={cn(
        "flex-1 h-12 border-border",
        isInWishlist && "text-red-500 border-red-200 bg-red-50 hover:bg-red-100",
        className
      )}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Heart
        className={cn("mr-2 h-4 w-4", isInWishlist && "fill-red-500")}
      />
      {isInWishlist ? t("in_wishlist") : t("add_to_favorites")}
    </Button>
  );
}
