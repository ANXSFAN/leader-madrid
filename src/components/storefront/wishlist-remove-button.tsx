"use client";

import { useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeFromWishlist } from "@/lib/actions/wishlist";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

interface WishlistRemoveButtonProps {
  productId: string;
}

export function WishlistRemoveButton({ productId }: WishlistRemoveButtonProps) {
  const t = useTranslations("product");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeFromWishlist(productId);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("removed_from_wishlist"));
      router.refresh();
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-destructive border-destructive/30 hover:bg-destructive/10"
      onClick={handleRemove}
      disabled={isPending}
    >
      <Heart className="h-4 w-4 fill-destructive" />
    </Button>
  );
}
