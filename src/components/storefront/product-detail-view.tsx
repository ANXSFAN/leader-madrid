"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  CheckCircle2,
  Truck,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Package,
  X,
  ZoomIn,
} from "lucide-react";
import { ProductDetailTabs } from "./ProductDetailTabs";
import { ProductCard } from "./product-card";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Product, ProductVariant, Category } from "@prisma/client";
import { getLocalized } from "@/lib/content";
import { formatMoney } from "@/lib/formatters";
import { useCartStore } from "@/lib/store/cart";
import { useSession } from "next-auth/react";
import { addToServerCart } from "@/lib/actions/cart";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { WishlistButton } from "./wishlist-button";

type RelatedProduct = Product & {
  variants: ProductVariant[];
  category?: Category | null;
};

interface ProductDetailViewProps {
  product: Product & {
    variants: ProductVariant[];
    category: Category | null;
  };
  isB2B?: boolean;
  priceMap?: Record<string, number>;
  relatedProducts?: RelatedProduct[];
  currency?: string;
  variantSpecsById?: Record<string, Record<string, unknown>> | null;
  isInWishlist?: boolean;
  documents?: { id: string; type: string; name: string; url: string; imageUrl?: string | null; description?: string | null }[];
  highlightAttributes?: { key: string; name: Record<string, string>; unit: string | null }[];
  initialVariantId?: string;
}

export function ProductDetailView({
  product,
  isB2B = false,
  priceMap = {},
  relatedProducts = [],
  currency = "EUR",
  variantSpecsById = null,
  isInWishlist = false,
  documents = [],
  highlightAttributes = [],
  initialVariantId,
}: ProductDetailViewProps) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const tAttributes = useTranslations("attributes");
  const locale = useLocale();
  const { data: session } = useSession();
  const { addItem } = useCartStore();

  const fm = (amount: number | string) =>
    formatMoney(amount, { locale, currency });

  const [selectedImg, setSelectedImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("specs");
  const [isAdding, setIsAdding] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Parse product data
  const content = getLocalized(product.content, locale);
  const imagesRaw = ((product.content as Record<string, unknown>)?.images as unknown[]) || [];
  const images = imagesRaw
    .map((img: unknown) => (typeof img === "string" ? img : (img as Record<string, string> | null)?.url))
    .filter(Boolean) as string[];

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setSelectedImg((p) => (p + 1) % (images.length || 1));
      if (e.key === "ArrowLeft") setSelectedImg((p) => (p - 1 + (images.length || 1)) % (images.length || 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, images.length]);

  // Variant Logic
  const hasVariants = product.variants && product.variants.length > 0;
  const defaultVariantId = hasVariants ? product.variants[0].id : "";
  const [selectedVariantId, setSelectedVariantId] = useState(
    initialVariantId || defaultVariantId
  );

  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.id === selectedVariantId) ||
      product.variants[0]
    : null;

  const normalizeSpecs = (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    return input as Record<string, unknown>;
  };

  const specsFromTypesense = normalizeSpecs(
    variantSpecsById?.[selectedVariantId]
  );
  const specsFromDb = normalizeSpecs(selectedVariant?.specs);
  const specsData =
    Object.keys(specsFromTypesense).length > 0
      ? specsFromTypesense
      : specsFromDb;

  const allVariantSpecs = product.variants.map((v) => {
    const ts = normalizeSpecs(variantSpecsById?.[v.id]);
    const db = normalizeSpecs(v?.specs);
    return Object.keys(ts).length > 0 ? ts : db;
  });

  const hiddenSpecKeys = (() => {
    if (!hasVariants || product.variants.length <= 1) return new Set<string>();
    const keys = ["color", "size", "cct", "power"];
    const toHide = new Set<string>();
    for (const key of keys) {
      const distinct = new Set(
        allVariantSpecs
          .map((s) => s?.[key])
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim() !== ""
          )
          .map((v) => String(v))
      );
      if (distinct.size > 1) toHide.add(key);
    }
    return toHide;
  })();

  const formatSpecLabel = (key: string) => {
    if (tAttributes.has(key)) return tAttributes(key);
    return key
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  };

  const formatSpecValue = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      const parts = value
        .map((v) => (v === undefined || v === null ? "" : String(v).trim()))
        .filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    if (typeof value === "string") {
      const v = value.trim();
      return v.length > 0 ? v : null;
    }
    if (typeof value === "number")
      return Number.isFinite(value) ? String(value) : null;
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  };

  const specEntries = Object.entries(specsData)
    .filter(
      ([key, value]) =>
        !hiddenSpecKeys.has(key) && formatSpecValue(value) !== null
    )
    .map(([key, value]) => ({
      key,
      label: formatSpecLabel(key),
      value: formatSpecValue(value) as string,
    }));

  // Quick Specs pills — only attributes marked isHighlight that have values
  const quickSpecs = highlightAttributes
    .map((attr) => {
      const rawVal = specsData[attr.key];
      const val = formatSpecValue(rawVal);
      if (!val) return null;
      const label = attr.name[locale] || attr.name["en"] || formatSpecLabel(attr.key);
      const display = attr.unit ? `${val} ${attr.unit}` : val;
      return { key: attr.key, label, value: display };
    })
    .filter(Boolean) as { key: string; label: string; value: string }[];

  const handleVariantChange = (id: string) => {
    setSelectedVariantId(id);
    // Update URL without triggering RSC navigation
    const url = new URL(window.location.href);
    url.searchParams.set("variant", id);
    window.history.replaceState({}, "", url.toString());
  };

  // Price Logic
  const rrp = Number(selectedVariant?.price || 0);
  const b2bPriceRaw = selectedVariant?.b2bPrice
    ? Number(selectedVariant.b2bPrice)
    : null;
  const calculatedPrice = selectedVariantId
    ? priceMap[selectedVariantId]
    : undefined;

  // Display prices
  // currentPrice = actual price the customer pays (used for add-to-cart)
  const currentPrice =
    calculatedPrice !== undefined ? calculatedPrice : isB2B && b2bPriceRaw !== null ? b2bPriceRaw : rrp;
  const compareAtPrice = selectedVariant?.compareAtPrice ? Number(selectedVariant.compareAtPrice) : null;
  // B2B effective price for the B2B box (independent of retail display)
  const effectiveB2bPrice = isB2B
    ? (calculatedPrice !== undefined && calculatedPrice < rrp ? calculatedPrice : b2bPriceRaw)
    : null;
  const stock = selectedVariant?.physicalStock || 0;
  const sku = selectedVariant?.sku || product.sku;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    setIsAdding(true);
    try {
      if (session?.user) {
        await addToServerCart(selectedVariant.id, quantity);
      }

      addItem({
        id: selectedVariant.id,
        productId: product.id,
        name: content.name,
        price: currentPrice,
        quantity: quantity,
        image: images[0],
        maxStock: stock,
      });

      toast.success(t("added_to_cart"));
    } catch (error) {
      console.error(error);
      toast.error(t("error_adding_to_cart"));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-card min-h-screen font-sans pb-20">
      {/* --- Breadcrumbs --- */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-accent">
            {tCommon("home")}
          </Link>
          <ChevronRight size={10} />
          {product.category && (
            <>
              <Link
                href={`/category/${product.category.slug}`}
                className="hover:text-accent"
              >
                {getLocalized(product.category.content, locale).name}
              </Link>
              <ChevronRight size={10} />
            </>
          )}
          <span className="text-foreground">{sku}</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* --- Left: Image Gallery --- */}
          <div className="lg:w-1/2 space-y-4">
            <div
              className="relative aspect-square bg-secondary rounded-2xl overflow-hidden border border-border group cursor-zoom-in"
              onClick={() => images.length > 0 && setLightboxOpen(true)}
            >
              {images[selectedImg] ? (
                <Image
                  src={images[selectedImg]}
                  alt={content.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={90}
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60 font-mono text-sm">
                  {t("no_image")}
                </div>
              )}

              <button className="absolute bottom-6 right-6 p-3 bg-card/80 backdrop-blur rounded-full text-muted-foreground hover:text-accent transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <ZoomIn size={20} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className={`aspect-square rounded-xl border-2 transition-all relative overflow-hidden ${selectedImg === i ? "border-accent bg-card" : "border-transparent bg-card border border-border hover:bg-secondary"}`}
                >
                  <Image
                    src={img}
                    alt={`View ${i}`}
                    fill
                    sizes="(max-width: 1024px) 25vw, 12vw"
                    quality={90}
                    className="object-contain"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* --- Right: Product Info & Purchase --- */}
          <div className="lg:w-1/2 flex flex-col">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight">
                {content.name}
              </h1>
              <span className="inline-block mt-4 text-lg font-semibold text-accent/80 uppercase tracking-widest">
                SKU: {sku}
              </span>
            </div>

            {/* Pricing Section */}
            <div className="p-6 mb-8">
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                    {t("price_public_excl_vat")}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-bold text-foreground ${effectiveB2bPrice !== null ? "line-through text-muted-foreground" : ""}`}>
                      {fm(rrp)}
                    </span>
                    {compareAtPrice && compareAtPrice > rrp && (
                      <span className="text-xl text-muted-foreground line-through font-bold">
                        {fm(compareAtPrice)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 ${stock > 0 ? "text-green-600" : "text-red-600"} text-sm font-bold uppercase tracking-widest`}
                  >
                    <div
                      className={`w-2 h-2 ${stock > 0 ? "bg-green-500" : "bg-red-500"} rounded-full animate-pulse`}
                    ></div>
                    {stock > 0 ? t("in_stock") : t("out_of_stock")}
                  </span>
                </div>
              </div>

              {/* B2B Price Highlight — only when there's an actual B2B discount */}
              {effectiveB2bPrice !== null && (
                <div className="bg-card rounded-xl p-4 border border-accent/20 bg-accent/5 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[11px] font-bold text-accent uppercase tracking-widest block">
                      {t("price_b2b_label")}
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {fm(effectiveB2bPrice)}{" "}
                      <small className="text-[11px] font-bold text-muted-foreground uppercase">
                        {t("excl_vat")}
                      </small>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full uppercase tracking-widest">
                    {t("active")}
                  </span>
                </div>
              )}
            </div>

            {/* Bulk pricing - will be implemented when PriceListRule data is available */}

            {/* Variants Selector */}
            {hasVariants && product.variants.length > 1 && (
              <div className="mb-8">
                <h4 className="text-[11px] font-bold text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Package size={14} className="text-accent" />{" "}
                  {t("variants")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantChange(variant.id)}
                      className={`px-4 py-2 rounded-lg border text-sm font-bold uppercase transition-all ${
                        selectedVariantId === variant.id
                          ? "border-accent bg-accent/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-accent/50"
                      }`}
                    >
                      {(variant as ProductVariant & { name?: string }).name ||
                        variant.sku ||
                        t("select_variant")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex items-center border border-border rounded-xl px-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 text-muted-foreground hover:text-foreground font-bold"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  readOnly
                  className="w-12 text-center border-none focus:ring-0 font-bold text-foreground outline-none"
                />
                <button
                  onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                  className="p-3 text-muted-foreground hover:text-foreground font-bold"
                  disabled={quantity >= stock}
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={stock <= 0 || isAdding}
                className="flex-1 bg-accent text-accent-foreground font-bold rounded-xl py-4 flex items-center justify-center gap-3 hover:opacity-90 transition-all group uppercase text-sm tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart
                  size={18}
                  className="group-hover:animate-bounce"
                />{" "}
                {stock > 0 ? t("add_to_cart") : t("out_of_stock")}
              </button>
              <WishlistButton
                productId={product.id}
                initialIsInWishlist={isInWishlist}
                variant="icon"
              />
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
              <div className="flex flex-col items-center text-center gap-2">
                <Truck size={20} className="text-accent" />
                <span className="text-[10px] font-bold text-foreground uppercase">
                  {t("express_shipping")}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <ShieldCheck size={20} className="text-accent" />
                <span className="text-[10px] font-bold text-foreground uppercase">
                  {t("secure_payment")}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <CheckCircle2 size={20} className="text-accent" />
                <span className="text-[10px] font-bold text-foreground uppercase">
                  {t("certified_quality")}
                </span>
              </div>
            </div>

            {/* Certificate Images */}
            {documents.filter((d) => d.type === "CERTIFICATE" && d.imageUrl).length > 0 && (
              <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-border">
                {documents
                  .filter((d) => d.type === "CERTIFICATE" && d.imageUrl)
                  .map((cert) => (
                    <div
                      key={cert.id}
                      className="relative h-16 w-16 rounded-lg border border-border bg-card p-1"
                      title={cert.name}
                    >
                      <Image
                        src={cert.imageUrl!}
                        alt={cert.name}
                        fill
                        sizes="64px"
                        quality={90}
                        className="object-contain p-1"
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Quick Specs Pills --- */}
        {quickSpecs.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-3">
            {quickSpecs.map((qs) => (
              <div
                key={qs.key}
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted/40 border border-border rounded-full text-sm"
              >
                <span className="text-muted-foreground">{qs.label}</span>
                <span className="font-semibold text-foreground">{qs.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* --- Bottom: Tabs Section --- */}
        <ProductDetailTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          specEntries={specEntries}
          description={content.description || ""}
          t={t}
          documents={documents}
        />
      </main>

      {/* --- Related Products --- */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-border py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-end mb-10">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                {t("related_products")}
              </h2>
              <Link
                href={
                  product.category ? `/category/${product.category.slug}` : "#"
                }
                className="text-sm font-bold text-foreground/70 hover:text-accent pb-1"
              >
                {tCommon("view_all")}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((item: RelatedProduct) => {
                // Adapt DB product shape to SerializedProduct
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- adapting DB product to SerializedProduct
                const serialized = {
                  ...item,
                  variants: (item.variants || []).map((v: ProductVariant) => ({
                    ...v,
                    price: Number(v.price),
                    b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : null,
                    compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
                    costPrice: v.costPrice ? Number(v.costPrice) : null,
                  })),
                  minPrice: 0,
                  maxPrice: 0,
                } as any;
                return (
                  <ProductCard
                    key={item.id}
                    product={serialized}
                    variant="simple"
                    currency={currency}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* --- Sticky Mobile Bar --- */}
      <div className="lg:hidden fixed bottom-14 left-0 w-full bg-card border-t border-border p-4 flex items-center gap-4 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div className="flex-1">
          {compareAtPrice && compareAtPrice > rrp && (
            <span className="text-sm text-muted-foreground line-through">
              {fm(compareAtPrice)}
            </span>
          )}
          <div className="text-2xl font-bold text-foreground leading-none">
            {fm(currentPrice)}
          </div>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={stock <= 0 || isAdding}
          className="flex-[2] bg-accent text-accent-foreground font-bold py-4 rounded-xl uppercase text-sm tracking-widest disabled:opacity-50"
        >
          {stock > 0 ? t("add_to_cart") : t("out_of_stock")}
        </button>
      </div>

      {/* --- Image Lightbox --- */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={28} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/60 text-sm font-medium z-10">
            {selectedImg + 1} / {images.length}
          </div>

          {/* Prev */}
          {images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImg((p) => (p - 1 + images.length) % images.length);
              }}
            >
              <ChevronLeft size={36} />
            </button>
          )}

          {/* Image */}
          <div
            className="relative w-[90vw] h-[85vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selectedImg]}
              alt={content.name}
              fill
              className="object-contain"
              sizes="90vw"
              quality={100}
            />
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImg((p) => (p + 1) % images.length);
              }}
            >
              <ChevronRight size={36} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
