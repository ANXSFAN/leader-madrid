"use client";

import { ProductCard, HighlightAttribute } from "@/components/storefront/product-card";
import { CheckCircle, Users, ShoppingBag, User, FileText, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Product, Category, ProductVariant } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import { HeroCarousel } from "./hero-carousel";

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
}

export function HomeView({
  featuredProducts,
  banners,
  isB2B,
  productPrices,
  currency = "EUR",
  highlightAttributes = [],
}: HomeViewProps) {
  const t = useTranslations("home");
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
                <Link href="/category/all">
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
            href="/category/all"
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
        <div className="bg-primary rounded-2xl px-8 py-[46px] md:px-12 md:py-[67px] flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="relative z-10 space-y-4 text-center md:text-left">
            <span className="bg-accent text-accent-foreground text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
              {t("weekly_offer")}
            </span>
            <h2 className="text-5xl font-bold text-primary-foreground leading-none">
              {t("promo_title")}
            </h2>
            <p className="text-primary-foreground/70 font-medium max-w-md">
              {t("promo_desc")}
            </p>
            <div className="flex gap-4 justify-center md:justify-start pt-2">
              <div className="bg-card/10 backdrop-blur-md p-3 rounded-lg text-center min-w-[60px]">
                <div className="text-2xl font-bold text-primary-foreground">02</div>
                <div className="text-[11px] uppercase font-medium text-primary-foreground/60">
                  {t("days")}
                </div>
              </div>
              <div className="bg-card/10 backdrop-blur-md p-3 rounded-lg text-center min-w-[60px]">
                <div className="text-2xl font-bold text-primary-foreground">14</div>
                <div className="text-[11px] uppercase font-medium text-primary-foreground/60">
                  {t("hours")}
                </div>
              </div>
              <div className="bg-card/10 backdrop-blur-md p-3 rounded-lg text-center min-w-[60px]">
                <div className="text-2xl font-bold text-primary-foreground">35</div>
                <div className="text-[11px] uppercase font-medium text-primary-foreground/60">
                  {t("minutes")}
                </div>
              </div>
            </div>
          </div>
          <Link href="/offers">
            <button className="relative z-10 px-10 py-5 bg-accent text-accent-foreground font-bold rounded-2xl hover:scale-105 transition-transform shadow-2xl uppercase tracking-widest text-base">
              {t("buy_now")}
            </button>
          </Link>
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
          <p className="text-red-500 text-sm">{error}</p>
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
