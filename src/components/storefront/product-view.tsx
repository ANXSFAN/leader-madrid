"use client";

import { useState, useEffect, useRef } from "react";
import { Product, ProductVariant, Category } from "@prisma/client";
import { getLocalized, ProductSpecs } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  Shield,
  Truck,
  Box,
  ShoppingCart,
  Heart,
  Share2,
  FileText,
  Loader2,
  Minus,
  Plus,
  ZoomIn,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store/cart";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { addToServerCart } from "@/lib/actions/cart";
import { RestockNotify } from "./restock-notify";
import { VariantSelector } from "./variant-selector";
import { WishlistButton } from "./wishlist-button";

type RelatedProductData = Product & {
  variants: ProductVariant[];
  category?: Category | null;
};

interface ProductViewProps {
  product: Product & {
    variants: ProductVariant[];
    category: Category | null;
  };
  isB2B?: boolean;
  priceMap?: Record<string, number>;
  relatedProducts?: RelatedProductData[];
  isInWishlist?: boolean;
}

export function ProductView({
  product,
  isB2B = false,
  priceMap = {},
  relatedProducts = [],
  isInWishlist = false,
}: ProductViewProps) {
  const t = useTranslations("product");
  const tRfq = useTranslations("rfq");
  const tCommon = useTranslations("common");
  const tAttributes = useTranslations("attributes");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const locale = useLocale();

  const hasVariants = product.variants && product.variants.length > 0;
  const variantIdFromUrl = searchParams.get("variant");
  const defaultVariantId = hasVariants ? product.variants[0].id : "";
  const selectedVariantId = variantIdFromUrl || defaultVariantId;

  const handleVariantChange = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const [isMounted, setIsMounted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [showQuickView, setShowQuickView] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const images = ((product.content as Record<string, unknown>)?.images as string[]) || [];
    if (images.length > 0) {
      setSelectedImage(images[0]);
      setCurrentImageIndex(0);
    }
    setImageError(false);
  }, [product.content]);

  const content = getLocalized(product.content, locale);
  const images = ((product.content as Record<string, unknown>)?.images as string[]) || [];
  const productContent = product.content as Record<string, unknown> | null;
  const description = (productContent?.description as string) || "";
  const longDescription = (productContent?.longDescription as string) || "";
  const datasheetUrl = (productContent?.datasheet as string) || null;
  const mainImage = selectedImage || images[0] || null;

  const selectedVariant = hasVariants
    ? product.variants.find((v) => v.id === selectedVariantId) ||
      product.variants[0]
    : null;

  const specs = selectedVariant?.specs as ProductSpecs;
  const rrp = Number(selectedVariant?.price || 0);
  const b2bPrice = selectedVariant?.b2bPrice
    ? Number(selectedVariant.b2bPrice)
    : rrp;
  const calculatedPrice = selectedVariantId ? priceMap[selectedVariantId] : undefined;
  const displayPrice: number =
    calculatedPrice !== undefined ? Number(calculatedPrice) : isB2B ? b2bPrice : rrp;
  const showDiscount = displayPrice < rrp;
  const stock = selectedVariant?.physicalStock || 0;

  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async () => {
    if (!selectedVariant || !isMounted) return;

    setIsAdding(true);

    try {
      addItem({
        id: selectedVariant.id,
        productId: product.id,
        name: content.name,
        price: displayPrice,
        quantity: quantity,
        maxStock: selectedVariant.physicalStock,
        image: mainImage || "",
      });

      if (session?.user && selectedVariant) {
        await addToServerCart(selectedVariant.id, quantity);
      }

      setIsSuccess(true);
      toast.success(t("added_to_cart"));

      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart", error);
      toast.error(t("error_adding"));
    } finally {
      setIsAdding(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  const nextImage = () => {
    const newIndex =
      currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const prevImage = () => {
    const newIndex =
      currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const useCarousel = images.length > 4;

  return (
    <div className="space-y-16">
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Left Column: Images */}
        <div className="space-y-4">
          {/* Main Image with Zoom on Hover */}
          <div
            ref={imageContainerRef}
            className="aspect-square bg-muted rounded-2xl flex items-center justify-center border border-border relative overflow-hidden cursor-zoom-in"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onMouseMove={handleMouseMove}
            onClick={() => stock > 0 && setShowQuickView(true)}
          >
            {mainImage && !imageError ? (
              <>
                <Image
                  src={mainImage}
                  alt={content.name}
                  fill
                  className={cn(
                    "object-cover transition-transform duration-300",
                    isHovering && "scale-150"
                  )}
                  style={
                    isHovering
                      ? {
                          transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
                        }
                      : undefined
                  }
                  onError={() => setImageError(true)}
                  priority
                />
                <div
                  className={cn(
                    "absolute inset-0 bg-black/0 transition-colors flex items-center justify-center pointer-events-none",
                    isHovering ? "bg-black/5" : "bg-black/0"
                  )}
                >
                  <div
                    className={cn(
                      "bg-white/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 text-base font-medium text-foreground/80 transition-opacity",
                      isHovering || stock <= 0 ? "opacity-0" : "opacity-100"
                    )}
                  >
                    <ZoomIn size={16} />
                    {t("hover_to_zoom")}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground font-bold text-7xl select-none">
                {tCommon("error_image")}
              </div>
            )}

            {/* Floating Badges */}
            <div className="absolute top-6 left-6 flex flex-col gap-2">
              {specs?.power && (
                <Badge className="bg-primary text-white hover:bg-primary/90 text-lg px-3 py-1">
                  {specs.power}
                </Badge>
              )}
              {product.category && (
                <Badge
                  variant="secondary"
                  className="bg-white/90 backdrop-blur text-foreground/80 border border-border"
                >
                  {getLocalized(product.category.content, locale).name}
                </Badge>
              )}
            </div>

            {/* Image Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Out of Stock Overlay */}
            {stock <= 0 && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <Badge className="bg-red-500 text-white text-xl px-6 py-2">
                  {t("out_of_stock")}
                </Badge>
              </div>
            )}
          </div>

          {/* Thumbnails - Carousel for > 4 images, Grid for <= 4 */}
          {images.length > 0 && (
            <div className="mt-4">
              {useCarousel ? (
                <div className="relative">
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {images.map((img: string, i: number) => (
                      <button
                        key={i}
                        className={cn(
                          "flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden relative transition-all",
                          selectedImage === img
                            ? "border-accent ring-2 ring-accent/20"
                            : "border-border hover:border-accent"
                        )}
                        onClick={() => {
                          setSelectedImage(img);
                          setCurrentImageIndex(i);
                        }}
                      >
                        <Image
                          src={img}
                          alt={`Thumbnail ${i + 1}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                  {images.length > 5 && (
                    <>
                      <button
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 bg-card shadow-lg rounded-full p-1 z-10"
                        onClick={prevImage}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 bg-card shadow-lg rounded-full p-1 z-10"
                        onClick={nextImage}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {images.map((img: string, i: number) => (
                    <button
                      key={i}
                      className={cn(
                        "aspect-square rounded-lg border-2 overflow-hidden relative transition-all",
                        selectedImage === img
                          ? "border-accent ring-2 ring-accent/20"
                          : "border-border hover:border-accent"
                      )}
                      onClick={() => {
                        setSelectedImage(img);
                        setCurrentImageIndex(i);
                      }}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${i + 1}`}
                        fill
                        sizes="(max-width: 768px) 25vw, 10vw"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Product Details */}
        <div className="flex flex-col">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">
              {content.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-base">
              <span>
                {tCommon("sku")}:{" "}
                <span className="font-mono text-foreground/80 font-semibold">
                  {selectedVariant?.sku}
                </span>
              </span>
              <span>•</span>
              <div className="flex items-center text-accent">
                ★★★★★ <span className="text-muted-foreground ml-1">(4.9)</span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-2">
              <span className="text-4xl sm:text-5xl font-bold text-foreground">
                €{displayPrice.toFixed(2)}
              </span>
              {showDiscount && (
                <span className="text-xl sm:text-2xl text-muted-foreground line-through">
                  €{rrp.toFixed(2)}
                </span>
              )}
              <span className="text-base text-muted-foreground">{t("plus_vat")}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {stock > 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-base font-medium bg-green-50 px-3 py-1 rounded-full">
                  <Check size={14} /> {t("stock_available", { stock })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 text-base font-medium bg-red-50 px-3 py-1 rounded-full">
                  <Box size={14} /> {t("out_of_stock")}
                </div>
              )}

              {datasheetUrl && (
                <a
                  href={datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-base text-accent hover:text-accent/80 font-medium"
                >
                  <Download size={14} />
                  {t("download_datasheet")}
                </a>
              )}
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Variant Selector Component */}
          {product.variants.length > 1 && (
            <div className="mb-8">
              <VariantSelector
                variants={product.variants}
                selectedVariantId={selectedVariantId}
                onVariantChange={handleVariantChange}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex items-end gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-base font-medium text-foreground/80">
                  {t("quantity")}
                </span>
                <div className="flex items-center border rounded-md h-14 bg-card">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-12 rounded-r-none hover:bg-muted"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <div className="flex-1 w-12 text-center font-semibold text-foreground">
                    {quantity}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-12 rounded-l-none hover:bg-muted"
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={quantity >= stock}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="flex-1">
                <Button
                  size="lg"
                  className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
                  onClick={handleAddToCart}
                  disabled={stock <= 0 || isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-5 w-5" />
                  )}
                  {stock > 0 ? t("add_to_cart") : t("out_of_stock")}
                </Button>
              </div>
            </div>

            {/* RFQ Button */}
            <Link href={`/${locale}/rfq`} className="w-full">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 text-lg border-border text-foreground/80 hover:bg-muted mt-4"
              >
                <FileText className="mr-2 h-5 w-5" />
                {tRfq("button_full")}
              </Button>
            </Link>

            {stock <= 0 && (
              <RestockNotify
                productName={content.name}
                variantId={selectedVariantId || undefined}
              />
            )}

            <div className="flex gap-4">
              <WishlistButton
                productId={product.id}
                initialIsInWishlist={isInWishlist}
              />
              <Button
                variant="outline"
                className="flex-1 h-12 border-border"
              >
                <Share2 className="mr-2 h-4 w-4" /> {t("share")}
              </Button>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-2 p-3 bg-card rounded-lg border border-border shadow-sm">
              <Shield className="text-accent h-6 w-6" />
              <span className="text-sm font-bold text-foreground/80">
                {t("warranty_5_years")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-card rounded-lg border border-border shadow-sm">
              <Truck className="text-accent h-6 w-6" />
              <span className="text-sm font-bold text-foreground/80">
                {t("shipping_24h")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-card rounded-lg border border-border shadow-sm">
              <FileText className="text-muted-foreground h-6 w-6" />
              <span className="text-sm font-bold text-foreground/80">
                {t("datasheet")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Add-to-Cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-40 lg:hidden shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-xl font-bold text-foreground">
              €{displayPrice.toFixed(2)}
            </div>
            {stock > 0 ? (
              <span className="text-sm text-green-600">{t("in_stock")}</span>
            ) : (
              <span className="text-sm text-red-500">{t("out_of_stock")}</span>
            )}
          </div>
          <Button
            size="lg"
            className="flex-1 h-12 bg-primary hover:bg-primary/90"
            onClick={handleAddToCart}
            disabled={stock <= 0 || isAdding}
          >
            {isAdding ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-5 w-5" />
            )}
            {stock > 0 ? t("add_to_cart") : t("out_of_stock")}
          </Button>
        </div>
      </div>

      {/* Product Information Accordion */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">
          {t("product_details")}
        </h2>
        <Accordion
          type="multiple"
          defaultValue={["description", "specs"]}
          className="w-full"
        >
          <AccordionItem value="description">
            <AccordionTrigger className="text-xl font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("description")}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="prose max-w-none">
                {longDescription ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: longDescription }}
                    className="text-muted-foreground leading-relaxed"
                  />
                ) : description ? (
                  <p className="text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">{t("no_description")}</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="specs">
            <AccordionTrigger className="text-xl font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                {t("specs")}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="w-1/3">{t("attribute")}</TableHead>
                      <TableHead>{t("value")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specs &&
                      Object.entries(specs).map(([key, value]) => {
                        if (!value || typeof value !== "string") return null;

                        const label = tAttributes.has(key)
                          ? tAttributes(key)
                          : key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase());

                        return (
                          <TableRow key={key}>
                            <TableCell className="font-medium text-muted-foreground capitalize">
                              {label}
                            </TableCell>
                            <TableCell className="text-foreground font-semibold">
                              {value}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shipping">
            <AccordionTrigger className="text-xl font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t("shipping_info")}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Truck className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {t("shipping_24h_title")}
                    </p>
                    <p className="text-base">{t("shipping_24h_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {t("warranty_title")}
                    </p>
                    <p className="text-base">{t("warranty_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Box className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {t("returns_title")}
                    </p>
                    <p className="text-base">{t("returns_desc")}</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Box className="h-6 w-6" />
            {t("related_products")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {relatedProducts.map((related) => {
              const relatedContent = getLocalized(related.content, locale);
              const relatedImages = ((related.content as Record<string, unknown>)?.images as string[]) || [];
              const relatedVariant = related.variants[0];
              const relatedPrice = relatedVariant
                ? Number(relatedVariant.price)
                : 0;
              const relatedStock = relatedVariant?.physicalStock || 0;

              return (
                <Link
                  key={related.id}
                  href={`/product/${related.slug}`}
                  className="group block"
                >
                  <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-accent hover:shadow-lg transition-all duration-300">
                    <div className="aspect-square relative bg-muted overflow-hidden">
                      {relatedImages[0] ? (
                        <Image
                          src={relatedImages[0]}
                          alt={relatedContent.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <Box size={48} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground text-base line-clamp-2 group-hover:text-accent transition-colors">
                        {relatedContent.name}
                      </h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-bold text-foreground">
                          €{relatedPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {relatedStock > 0 ? (
                          <span className="text-green-600">
                            {t("in_stock")}
                          </span>
                        ) : (
                          <span className="text-red-500">
                            {t("out_of_stock")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile bottom padding for sticky cart */}
      <div className="h-24 lg:hidden" />
    </div>
  );
}
