"use client";

import { ProductCard, HighlightAttribute } from "@/components/storefront/product-card";
import { CheckCircle, Users, ShoppingBag, User, FileText, Loader2, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Product, Category, ProductVariant } from "@prisma/client";
import { useTranslations, useLocale } from "next-intl";
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import { HeroCarousel } from "./hero-carousel";
import { getLocalized } from "@/lib/content";
import Image from "next/image";

interface HomeViewProps {
  featuredProducts: (Product & {
    category: Category | null;
    variants: ProductVariant[];
  })[];
  banners: any[];
  isB2B: boolean;
  productPrices: Record<string, number>;
  currency?: string;
  highlightAttributes?: HighlightAttribute[];
  categories?: Category[];
}

export function HomeView({
  featuredProducts,
  banners,
  isB2B,
  productPrices,
  currency = "EUR",
  highlightAttributes = [],
  categories = [],
}: HomeViewProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { data: session } = useSession();

  return (
    <div className="font-sans text-foreground bg-background min-h-screen">
      {/* --- Hero Section --- */}
      {banners.length > 0 ? (
        <HeroCarousel banners={banners} />
      ) : (
        <section className="relative h-[500px] bg-primary flex items-center overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent"></div>
          <div
            className="absolute inset-0 opacity-40 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80')",
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/60 to-transparent"></div>
          <div className="relative max-w-7xl mx-auto px-4 w-full grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-6xl md:text-7xl font-bold text-primary-foreground leading-tight">
                {t("hero_title")}{" "}
                <span className="text-accent">{t("hero_title_brand")}</span>
              </h1>
              <p className="text-xl text-primary-foreground/70 max-w-lg">
                {t("hero_description")}
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/search">
                  <button className="px-8 py-4 bg-accent hover:opacity-90 text-accent-foreground font-bold rounded-lg transition-all shadow-lg uppercase text-sm tracking-widest">
                    {t("shop_online")}
                  </button>
                </Link>
                <Link href={isB2B ? "/b2b/dashboard" : "/apply-b2b"}>
                  <button className="px-8 py-4 border border-primary-foreground/20 text-primary-foreground font-bold rounded-lg hover:bg-primary-foreground/10 transition-all uppercase text-sm tracking-widest">
                    {t("b2b_area")}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --- Category Grid --- */}
      {categories.length > 0 && (
        <section className="py-16 max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-bold text-foreground tracking-tight">
                {t("shop_by_category")}
              </h2>
            </div>
            <Link
              href="/search"
              className="text-base font-medium text-foreground/70 hover:text-accent transition-colors"
            >
              {t("view_all_shop")}
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((cat) => {
              const catContent = getLocalized(cat.content, locale);
              const imageUrl = (cat.content as Record<string, unknown>)?.imageUrl as string | undefined;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-secondary hover:shadow-lg transition-all"
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={catContent.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/10" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {catContent.name}
                      <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* --- B2C Section: Featured Products --- */}
      <section className="py-16 max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-accent">{t("featured_desc")}</span>
            <h2 className="text-4xl font-bold text-foreground tracking-tight mt-1">
              {t("featured_products")}
            </h2>
          </div>
          <Link
            href="/search"
            className="text-base font-medium text-foreground/70 hover:text-accent transition-colors"
          >
            {t("view_all_shop")}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product as any}
              isB2B={isB2B}
              price={productPrices[product.id]}
              currency={currency}
              variant="simple"
              highlightAttributes={highlightAttributes}
            />
          ))}
        </div>
      </section>

      {/* --- Flash Promo Banner --- */}
      <section className="max-w-7xl mx-auto px-4 mb-20">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background with diagonal split */}
          <div className="absolute inset-0 bg-primary" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/10 skew-x-[-6deg] translate-x-12 hidden md:block" />
          {/* Decorative elements */}
          <div className="absolute top-6 left-6 w-20 h-20 border-2 border-primary-foreground/10 rounded-full" />
          <div className="absolute top-10 left-10 w-12 h-12 border-2 border-primary-foreground/5 rounded-full" />
          <div className="absolute bottom-8 right-[45%] w-16 h-16 border-2 border-accent/20 rounded-full hidden md:block" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />
          <div className="absolute -top-8 right-1/4 w-40 h-40 bg-accent/8 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-0">
            {/* Left: text content */}
            <div className="flex-1 px-8 py-10 md:px-12 md:py-14 space-y-5 text-center md:text-left">
              <span className="inline-block bg-accent text-accent-foreground text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
                {t("weekly_offer")}
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground leading-tight">
                {t("promo_title")}
              </h2>
              <p className="text-primary-foreground/70 font-medium max-w-md text-lg leading-relaxed">
                {t("promo_desc")}
              </p>
              <div className="flex items-center gap-4 justify-center md:justify-start pt-1">
                <Link href="/offers">
                  <button className="px-8 py-4 bg-accent text-accent-foreground font-bold rounded-xl hover:opacity-90 transition-all shadow-lg uppercase tracking-widest text-sm">
                    {t("buy_now")}
                  </button>
                </Link>
                <Link
                  href="/search"
                  className="text-primary-foreground/60 hover:text-accent font-semibold text-sm uppercase tracking-wider transition-colors flex items-center gap-1"
                >
                  {t("view_all_shop")}
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            {/* Right: big discount display */}
            <div className="flex-shrink-0 px-8 pb-10 md:pb-0 md:px-12 md:py-14 flex flex-col items-center justify-center">
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl scale-110" />
                <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full border-4 border-dashed border-accent/40 flex flex-col items-center justify-center bg-primary-foreground/5 backdrop-blur-sm">
                  <span className="text-accent text-lg font-bold uppercase tracking-wider">{t("weekly_offer")}</span>
                  <span className="text-6xl md:text-7xl font-black text-primary-foreground leading-none">40<span className="text-4xl md:text-5xl">%</span></span>
                  <span className="text-primary-foreground/50 text-sm font-bold uppercase tracking-widest">OFF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- B2B Lead Section --- */}
      <section className="bg-primary py-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-20">
          <div className="lg:w-1/2 space-y-8">
            <h2 className="text-5xl font-bold text-primary-foreground leading-tight tracking-tight">
              {t("b2b_title")}
            </h2>
            <p className="text-primary-foreground/70 text-xl leading-relaxed">
              {t("b2b_desc")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: t("b2b_feature_pricing"), desc: t("b2b_feature_pricing_desc") },
                { title: t("b2b_feature_invoicing"), desc: t("b2b_feature_invoicing_desc") },
                { title: t("b2b_feature_dialux"), desc: t("b2b_feature_dialux_desc") },
                { title: t("b2b_feature_shipping"), desc: t("b2b_feature_shipping_desc") },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 bg-primary-foreground/5 rounded-xl p-4">
                  <CheckCircle
                    className="text-accent flex-shrink-0"
                    size={20}
                  />
                  <div>
                    <h4 className="font-bold text-primary-foreground text-base uppercase">
                      {item.title}
                    </h4>
                    <p className="text-sm text-primary-foreground/50 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Link href="/apply-b2b">
                <button className="px-10 py-4 bg-accent text-accent-foreground font-bold rounded-xl hover:opacity-90 transition-all uppercase tracking-widest text-base">
                  {t("create_pro_account")}
                </button>
              </Link>
            </div>
          </div>
          <div className="lg:w-1/2 relative">
            <div className="w-full aspect-square rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur-md p-8 flex flex-col justify-center items-center text-center">
              <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center text-accent-foreground mb-6">
                <Users size={48} />
              </div>
              <h3 className="text-3xl font-bold text-primary-foreground mb-4 tracking-tight">
                {t("distributor_portal")}
              </h3>

              {session?.user ? (
                /* --- Logged In: Welcome + Quick Links --- */
                <div className="w-full space-y-4">
                  <p className="text-primary-foreground/60 mb-2">
                    {t("welcome_back")}, <span className="font-bold text-primary-foreground">{session.user.name}</span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    <Link href="/profile?tab=orders">
                      <button className="w-full py-3 bg-primary-foreground/5 hover:bg-primary-foreground/10 text-primary-foreground font-bold rounded-lg text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                        <ShoppingBag size={16} /> {t("my_orders")}
                      </button>
                    </Link>
                    <Link href="/profile">
                      <button className="w-full py-3 bg-primary-foreground/5 hover:bg-primary-foreground/10 text-primary-foreground font-bold rounded-lg text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                        <User size={16} /> {t("my_account")}
                      </button>
                    </Link>
                    <Link href="/rfq">
                      <button className="w-full py-3 bg-accent hover:opacity-90 text-accent-foreground font-bold rounded-lg text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                        <FileText size={16} /> {t("request_quote")}
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* --- Not Logged In: Mini Login Form --- */
                <DealerLoginForm t={t} />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DealerLoginForm({ t }: { t: any }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError(t("login_error"));
    }
    setLoading(false);
  };

  return (
    <div className="w-full space-y-4">
      <p className="text-primary-foreground/60 mb-2">{t("portal_desc")}</p>
      <form onSubmit={handleLogin} className="space-y-3 w-full">
        <input
          type="email"
          placeholder={t("login_email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 border border-primary-foreground/10 bg-primary-foreground/5 text-primary-foreground rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-primary-foreground/30"
        />
        <input
          type="password"
          placeholder={t("login_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 border border-primary-foreground/10 bg-primary-foreground/5 text-primary-foreground rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-primary-foreground/30"
        />
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-accent text-accent-foreground font-bold rounded-lg uppercase text-sm tracking-widest hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {t("login_submit")}
        </button>
      </form>
      <Link
        href="/register"
        className="text-base text-accent hover:opacity-80 font-bold"
      >
        {t("create_account")}
      </Link>
    </div>
  );
}
