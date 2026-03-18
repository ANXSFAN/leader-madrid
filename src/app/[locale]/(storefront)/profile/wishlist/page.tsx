import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { getWishlist } from "@/lib/actions/wishlist";
import { getLocalized } from "@/lib/content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Heart, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney } from "@/lib/formatters";
import Image from "next/image";
import { WishlistRemoveButton } from "@/components/storefront/wishlist-remove-button";
import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "profile" });
  return { title: t("wishlist.title"), robots: { index: false } };
}

export default async function WishlistPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect({ href: "/login", locale: params.locale });
  }

  const [wishlistItems, settings, tProfile, tProduct] = await Promise.all([
    getWishlist(),
    getSiteSettings(),
    getTranslations("profile"),
    getTranslations("product"),
  ]);

  const { locale } = params;
  const fm = (amount: number | string) =>
    formatMoney(amount, { locale, currency: settings.currency });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500" />
          {tProfile("wishlist.title")}
        </h1>
        <Button variant="outline" asChild>
          <Link href="/profile">{tProfile("title")}</Link>
        </Button>
      </div>

      {wishlistItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {tProfile("wishlist.empty")}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              {tProfile("wishlist.empty_desc")}
            </p>
            <Button asChild className="bg-accent hover:bg-accent/90">
              <Link href="/">
                <ShoppingBag className="w-4 h-4 mr-2" />
                {tProfile("orders.start_shopping")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistItems.map((item) => {
            const content = getLocalized(item.product.content, locale);
            const images = (item.product.content as any)?.images || [];
            const mainImage = images[0] || null;
            const lowestVariant = item.product.variants[0];
            const price = lowestVariant ? Number(lowestVariant.price) : 0;
            const stock = lowestVariant?.physicalStock || 0;

            return (
              <Card
                key={item.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link href={`/product/${item.product.slug}`}>
                  <div className="aspect-square relative bg-muted overflow-hidden">
                    {mainImage ? (
                      <Image
                        src={mainImage}
                        alt={content.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground/50">
                        <ShoppingBag size={48} />
                      </div>
                    )}
                    {stock <= 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          {tProduct("out_of_stock")}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
                <CardContent className="p-4">
                  <Link href={`/product/${item.product.slug}`}>
                    <h3 className="font-semibold text-foreground text-sm line-clamp-2 hover:text-accent transition-colors mb-2">
                      {content.name}
                    </h3>
                  </Link>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-foreground">
                      {fm(price)}
                    </span>
                    {stock > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        {tProduct("in_stock")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-primary hover:bg-primary/90"
                      asChild
                    >
                      <Link href={`/product/${item.product.slug}`}>
                        <ShoppingBag className="h-4 w-4 mr-1" />
                        {tProduct("view_product")}
                      </Link>
                    </Button>
                    <WishlistRemoveButton productId={item.productId} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
