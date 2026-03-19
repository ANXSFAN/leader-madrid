"use client";

import { SerializedProduct } from "@/lib/types/search";
import { getLocalized } from "@/lib/content";
import { useCartStore } from "@/lib/store/cart";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import {
  Eye,
  Heart,
  ShoppingCart,
  Image as ImageIcon,
  Search,
  Download,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { addToServerCart } from "@/lib/actions/cart";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/formatters";

export type HighlightAttribute = {
  key: string;
  name: Record<string, string>;
  unit: string | null;
};

interface ProductCardProps {
  product: SerializedProduct;
  isB2B?: boolean;
  price?: number;
  viewMode?: "grid" | "list";
  showSpecs?: boolean;
  variant?: "default" | "simple";
  currency?: string;
  highlightAttributes?: HighlightAttribute[];
}

export function ProductCard({
  product,
  isB2B = false,
  price,
  viewMode = "grid",
  showSpecs = true,
  variant = "default",
  currency = "EUR",
  highlightAttributes = [],
}: ProductCardProps) {
  const t = useTranslations("product");
  const locale = useLocale();
  const fmt = (amount: number | string) => formatMoney(amount, { locale, currency });
  const { data: session } = useSession();
  const { addItem } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const [imageFit, setImageFit] = useState<"cover" | "contain">("cover");
  const [imageReady, setImageReady] = useState(false);

  // Force showSpecs to false if variant is simple
  const shouldShowSpecs = variant === "simple" ? false : showSpecs;

  const content = getLocalized(product.content, locale);
  const images = (product.content as any)?.images || [];
  const mainImage = images.length > 0 ? images[0] : null;
  const imageUrl = typeof mainImage === "string" ? mainImage : mainImage?.url;

  const firstVariant = product.variants?.[0];
  const rrp = firstVariant?.price ? Number(firstVariant.price) : 0;
  const displayPrice = price !== undefined ? price : rrp;

  const compareAtPrice = firstVariant?.compareAtPrice ? Number(firstVariant.compareAtPrice) : null;
  const oldPrice = rrp > displayPrice ? rrp : compareAtPrice;
  const sku = firstVariant?.sku || product.id.slice(0, 8).toUpperCase();

  // Build highlight specs from variant specs + highlight attribute definitions
  const variantSpecs = (firstVariant?.specs && typeof firstVariant.specs === "object")
    ? firstVariant.specs as Record<string, unknown>
    : null;

  // highlightAttributes already sorted by backend drag-sort priority, take max 4
  const highlightSpecs = variantSpecs && highlightAttributes.length > 0
    ? highlightAttributes
        .map((attr) => {
          const rawVal = variantSpecs[attr.key];
          if (rawVal === null || rawVal === undefined || rawVal === "") return null;
          const val = typeof rawVal === "string" ? rawVal.trim()
            : typeof rawVal === "number" ? String(rawVal)
            : String(rawVal);
          if (!val) return null;
          const label = attr.name[locale] || attr.name["en"] || attr.key;
          const display = attr.unit ? `${val} ${attr.unit}` : val;
          return { key: attr.key, label, value: display };
        })
        .filter(Boolean)
        .slice(0, 4) as { key: string; label: string; value: string }[]
    : [];

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsAdding(true);

    if (session?.user) {
      try {
        if (!firstVariant?.id) {
          toast.error(t("error_no_variant"));
          return;
        }
        await addToServerCart(firstVariant.id, 1);

        addItem({
          id: firstVariant.id,
          productId: product.id,
          name: content.name,
          price: displayPrice,
          image: imageUrl,
          quantity: 1,
          maxStock: firstVariant.physicalStock || 99,
        });

        toast.success(t("added_to_cart"));
      } catch (error) {
        toast.error(t("error_adding_to_cart"));
      }
    } else {
      if (!firstVariant?.id) {
        toast.error(t("error_no_variant"));
        return;
      }
      addItem({
        id: firstVariant.id,
        productId: product.id,
        name: content.name,
        price: displayPrice,
        image: imageUrl,
        quantity: 1,
        maxStock: firstVariant.physicalStock || 99,
      });
      toast.success(t("added_to_cart"));
    }

    setIsAdding(false);
  };

  return (
    <div
      className={`group bg-card border border-border rounded-xl overflow-hidden hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-500 flex ${
        viewMode === "list" ? "flex-row min-h-[16rem]" : "flex-col"
      }`}
    >
      {/* Image Area */}
      <div
        className={`relative ${
          viewMode === "list" ? "w-1/3" : "h-64"
        } bg-secondary flex items-center justify-center overflow-hidden`}
      >
        <Link href={`/product/${product.slug}`} className="absolute inset-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={content.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              quality={90}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.naturalWidth && img.naturalHeight) {
                  const ratio = img.naturalWidth / img.naturalHeight;
                  // 接近容器比例(~1.4)的横图用cover填满，偏差大的用contain完整展示
                  if (ratio < 0.8 || ratio > 2.2) {
                    setImageFit("contain");
                  }
                }
                setImageReady(true);
              }}
              className={`${
                imageFit === "cover" ? "object-cover" : "object-contain"
              } group-hover:scale-105 transition-all duration-500 ${
                imageReady ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
              <ImageIcon size={32} />
              <span className="text-[11px] uppercase font-mono mt-2">
                {t("no_image")}
              </span>
            </div>
          )}
        </Link>

        {/* Quick Actions */}
        <div
          className={
            variant === "simple"
              ? "absolute top-4 right-4 flex flex-col gap-2 translate-x-0 md:translate-x-12 md:group-hover:translate-x-0 transition-transform duration-300 z-10"
              : `absolute ${
                  viewMode === "list" ? "bottom-4" : "bottom-4"
                } left-1/2 -translate-x-1/2 flex gap-2 translate-y-0 md:translate-y-12 md:group-hover:translate-y-0 transition-transform duration-300 z-10`
          }
        >
          {variant !== "simple" && (
            <button className="p-2.5 bg-card rounded-full shadow-lg text-muted-foreground hover:text-accent transition-colors">
              <Search size={16} />
            </button>
          )}
          <button className="p-2.5 bg-card rounded-full shadow-lg text-muted-foreground hover:text-destructive transition-colors">
            <Heart size={16} />
          </button>
          <button className="p-2.5 bg-card rounded-full shadow-lg text-muted-foreground hover:text-accent transition-colors">
            {variant === "simple" ? <Eye size={16} /> : <Download size={16} />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 flex-1 flex flex-col">
        {variant === "simple" ? (
          // Simple Variant Layout (Reference Style)
          <>
            <Link href={`/product/${product.slug}`}>
              <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-accent transition-colors line-clamp-2">
                {content.name}
              </h3>
            </Link>
            <div className="mt-auto pt-4 flex items-center justify-between">
              <div>
                {oldPrice && oldPrice > displayPrice && (
                  <span className="text-sm text-muted-foreground line-through block">
                    {fmt(oldPrice)}
                  </span>
                )}
                <div className="text-2xl font-bold text-foreground">
                  {fmt(displayPrice)}
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="h-9 w-9 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                <ShoppingCart size={18} />
              </button>
            </div>
          </>
        ) : (
          // Default Variant Layout
          <>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                {t("sku_label")} {sku}
              </span>
            </div>

            <Link href={`/product/${product.slug}`}>
              <h3 className="text-base font-medium text-foreground leading-tight mb-4 group-hover:text-accent transition-colors line-clamp-2">
                {content.name}
              </h3>
            </Link>

            {shouldShowSpecs && highlightSpecs.length > 0 && (
              <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden mb-4">
                {highlightSpecs.map((spec, i) => (
                  <div
                    key={spec.key}
                    className={`bg-card px-3 py-2 flex flex-col${
                      highlightSpecs.length % 2 === 1 && i === highlightSpecs.length - 1
                        ? " col-span-2"
                        : ""
                    }`}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1">
                      {spec.label}
                    </span>
                    <span className="text-sm font-bold text-foreground leading-tight truncate">
                      {spec.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  {t("price_label_excl_vat")}
                </div>
                <div className="text-3xl font-bold text-foreground leading-none">
                  {fmt(displayPrice)}
                </div>
                {isB2B && firstVariant?.b2bPrice && (
                  <div className="text-[11px] font-bold text-accent mt-1 uppercase">
                    {t("b2b_price")}: {fmt(Number(firstVariant.b2bPrice))} {t("plus_vat")}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  className="h-9 w-9 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <ShoppingBag size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
