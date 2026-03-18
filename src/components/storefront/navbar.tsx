"use client";

import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { SearchBar } from "./search-bar";
import { UserNav } from "./user-nav";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Phone,
  Truck,
  ChevronRight,
  ChevronDown,
  FileText,
  Lightbulb,
  Search,
} from "lucide-react";
import { Category } from "@prisma/client";
import { SiteSettingsData } from "@/lib/actions/config";
import { getLocalized } from "@/lib/content";
import { useState } from "react";
import { CartSheet } from "./cart-sheet";
import { useTranslations, useLocale } from "next-intl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { MegaMenuData } from "@/lib/types/mega-menu";
import { LocaleSelector } from "./locale-selector";
import { MobileSearchOverlay } from "./mobile-search-overlay";
import type { SupportedCurrency } from "@/lib/currency";

interface NavbarProps {
  categories: (Category & {
    children: (Category & { children: Category[] })[];
  })[];
  settings?: SiteSettingsData;
  megaMenuSolutions?: MegaMenuData | null;
  megaMenuResources?: MegaMenuData | null;
  displayCurrency?: SupportedCurrency;
  enabledCurrencies?: SupportedCurrency[];
  exchangeRate?: number;
}

/** Get localized string from a Record<string, string> with fallback */
function getLocalizedStr(obj: Record<string, string> | undefined, locale: string): string {
  if (!obj) return "";
  return obj[locale] || obj["en"] || Object.values(obj)[0] || "";
}

export function Navbar({ categories, settings, megaMenuSolutions, megaMenuResources, displayCurrency, enabledCurrencies, exchangeRate = 1 }: NavbarProps) {
  const t = useTranslations("navbar");
  const locale = useLocale();
  const { data: session } = useSession();
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [activeL1, setActiveL1] = useState<string | null>(
    categories.length > 0 ? categories[0].id : null
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Fallback static data for Solutions mega menu
  const solucionesData = [
    {
      title: t("by_industry"),
      items: [
        { label: t("sol_warehouses"), href: "#" },
        { label: t("sol_factories"), href: "#" },
        { label: t("sol_parking"), href: "#" },
        { label: t("sol_sports"), href: "#" },
      ],
    },
    {
      title: t("retail_hospitality"),
      items: [
        { label: t("sol_supermarkets"), href: "#" },
        { label: t("sol_fashion"), href: "#" },
        { label: t("sol_hotels"), href: "#" },
        { label: t("sol_restaurants"), href: "#" },
      ],
    },
    {
      title: t("pro_services"),
      items: [
        { label: t("sol_dialux"), href: "#" },
        { label: t("sol_energy_audit"), href: "#" },
        { label: t("sol_turnkey"), href: "#" },
        { label: t("sol_oem"), href: "#" },
      ],
    },
  ];

  // Fallback static data for Resources mega menu
  const recursosData = [
    {
      title: t("downloads"),
      items: [
        { label: t("res_catalog"), href: "#" },
        { label: t("res_price_list"), href: "#" },
        { label: t("res_datasheets"), href: "#" },
        { label: t("res_ies_ldt"), href: "#" },
      ],
    },
    {
      title: t("support_section"),
      items: [
        { label: t("res_warranty"), href: "#" },
        { label: t("res_faq"), href: "#" },
        { label: t("res_install_guides"), href: "#" },
        { label: t("res_certificates"), href: "#" },
      ],
    },
  ];

  // Build solutions columns from CMS or fallback
  const solColumns = megaMenuSolutions?.columns
    ? megaMenuSolutions.columns.map((col) => ({
        title: getLocalizedStr(col.title, locale),
        items: col.items.map((item) => ({
          label: getLocalizedStr(item.label, locale),
          href: item.href || (item.pageSlug ? `/solutions/${item.pageSlug}` : "#"),
        })),
      }))
    : solucionesData;

  const solPromo = megaMenuSolutions?.promo;

  // Build resources columns from CMS or fallback
  // Resources items use href directly (external links, PDFs) or fall back to /resources/{pageSlug}
  const resColumns = megaMenuResources?.columns
    ? megaMenuResources.columns.map((col) => ({
        title: getLocalizedStr(col.title, locale),
        items: col.items.map((item) => ({
          label: getLocalizedStr(item.label, locale),
          href: item.href || (item.pageSlug ? `/resources/${item.pageSlug}` : "#"),
        })),
      }))
    : recursosData;

  return (
    <>
    <MobileSearchOverlay open={mobileSearchOpen} onClose={() => setMobileSearchOpen(false)} />
    <div className="font-sans text-foreground bg-card sticky top-0 z-50 border-b border-border">
      {/* Top Bar */}
      <div className="bg-primary text-primary-foreground text-[12px] py-2 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-6 items-center">
            <span className="flex items-center gap-1.5">
              <Truck size={12} className="text-accent" /> {t("free_shipping_banner")}
            </span>
            <span className="hidden md:flex items-center gap-1.5">
              <Phone size={12} className="text-accent" /> {t("support")}{" "}
              {settings?.phoneNumber || "+86 755-8888-6666"}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/profile" className="hover:text-accent transition-colors">
              {t("order_tracking")}
            </Link>
            <div className="h-3 w-px bg-primary-foreground/20"></div>
            <LocaleSelector />
            <div className="h-3 w-px bg-primary-foreground/20"></div>
            {session?.user ? (
              <UserNav user={session.user} />
            ) : (
              <Link
                href="/login"
                className="hover:text-accent transition-colors font-bold"
              >
                {t("login_register")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative bg-card/95 backdrop-blur-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          <img src={settings?.logoUrl || "/logo.jpg"} alt={settings?.siteName || "Leader Madrid"} className="h-12 object-contain rounded" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 h-full">
          {/* PRODUCTS */}
          <div
            className="h-full flex items-center"
            onMouseEnter={() => setActiveMega("productos")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <button
              className={`px-3 py-1.5 flex items-center gap-1 text-base font-medium transition-all rounded-md ${
                activeMega === "productos"
                  ? "bg-secondary text-foreground"
                  : "text-foreground/70 hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t("products")}{" "}
              <ChevronRight
                size={14}
                className={`transition-transform ${
                  activeMega === "productos" ? "rotate-90" : ""
                }`}
              />
            </button>
          </div>

          {/* SOLUTIONS */}
          <div
            className="h-full flex items-center"
            onMouseEnter={() => setActiveMega("soluciones")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <button
              className={`px-3 py-1.5 flex items-center gap-1 text-base font-medium transition-all rounded-md ${
                activeMega === "soluciones"
                  ? "bg-secondary text-foreground"
                  : "text-foreground/70 hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t("solutions")}{" "}
              <ChevronRight
                size={14}
                className={`transition-transform ${
                  activeMega === "soluciones" ? "rotate-90" : ""
                }`}
              />
            </button>
          </div>

          {/* RESOURCES */}
          <div
            className="h-full flex items-center"
            onMouseEnter={() => setActiveMega("recursos")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <button
              className={`px-3 py-1.5 flex items-center gap-1 text-base font-medium transition-all rounded-md ${
                activeMega === "recursos"
                  ? "bg-secondary text-foreground"
                  : "text-foreground/70 hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t("resources")}{" "}
              <ChevronRight
                size={14}
                className={`transition-transform ${
                  activeMega === "recursos" ? "rotate-90" : ""
                }`}
              />
            </button>
          </div>

          <Link
            href="/offers"
            className="px-3 py-1.5 flex items-center text-base font-medium text-accent hover:bg-accent/10 rounded-md transition-all"
          >
            {t("offers")}
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:block lg:w-48 xl:w-72">
            <SearchBar />
          </div>

          <button
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={22} />
          </button>

          <CartSheet currency={displayCurrency || settings?.currency || "EUR"} exchangeRate={exchangeRate} />

          <Link
            href="/contact"
            className="hidden md:block px-6 py-3 bg-accent hover:opacity-90 text-accent-foreground text-[12px] font-bold rounded-lg transition-all uppercase tracking-wider"
          >
            {t("contact_engineer")}
          </Link>

          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden p-2">
                <Menu size={24} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] flex flex-col p-0">
              <div className="flex flex-col flex-1 overflow-y-auto overscroll-contain px-6 pt-8 pb-24">
                {/* Products — collapsible */}
                <div className="border-b">
                  <button
                    className="w-full flex items-center justify-between py-3 font-bold text-foreground"
                    onClick={() => setMobileExpanded(mobileExpanded === "products" ? null : "products")}
                  >
                    {t("products")}
                    {mobileExpanded === "products" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {mobileExpanded === "products" && (
                    <div className="pb-3 space-y-1">
                      {categories.map((cat) => (
                        <div key={cat.id}>
                          <Link
                            href={`/category/${cat.slug}`}
                            className="block text-sm font-semibold text-foreground/80 hover:text-accent transition-colors py-1.5 pl-3"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {getLocalized(cat.content, locale).name}
                          </Link>
                          {cat.children.length > 0 && (
                            <div className="pl-6 space-y-0.5">
                              {cat.children.map((sub) => (
                                <Link
                                  key={sub.id}
                                  href={`/category/${sub.slug}`}
                                  className="block text-sm text-muted-foreground hover:text-accent transition-colors py-1"
                                  onClick={() => setIsMenuOpen(false)}
                                >
                                  {getLocalized(sub.content, locale).name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Solutions — collapsible */}
                <div className="border-b">
                  <button
                    className="w-full flex items-center justify-between py-3 font-bold text-foreground"
                    onClick={() => setMobileExpanded(mobileExpanded === "solutions" ? null : "solutions")}
                  >
                    {t("solutions")}
                    {mobileExpanded === "solutions" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {mobileExpanded === "solutions" && (
                    <div className="pb-3 space-y-1">
                      {solColumns.map((col, idx) => (
                        <div key={idx}>
                          <span className="block text-sm font-semibold text-foreground/70 py-1.5 pl-3">{col.title}</span>
                          <div className="pl-6 space-y-0.5">
                            {col.items.map((item, i) => (
                              <Link
                                key={i}
                                href={item.href}
                                className="block text-sm text-muted-foreground hover:text-accent transition-colors py-1"
                                onClick={() => setIsMenuOpen(false)}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resources — collapsible */}
                <div className="border-b">
                  <button
                    className="w-full flex items-center justify-between py-3 font-bold text-foreground"
                    onClick={() => setMobileExpanded(mobileExpanded === "resources" ? null : "resources")}
                  >
                    {t("resources")}
                    {mobileExpanded === "resources" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {mobileExpanded === "resources" && (
                    <div className="pb-3 space-y-1">
                      {resColumns.map((col, idx) => (
                        <div key={idx}>
                          <span className="block text-sm font-semibold text-foreground/70 py-1.5 pl-3">{col.title}</span>
                          <div className="pl-6 space-y-0.5">
                            {col.items.map((item, i) => (
                              <Link
                                key={i}
                                href={item.href}
                                className="block text-sm text-muted-foreground hover:text-accent transition-colors py-1"
                                onClick={() => setIsMenuOpen(false)}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Offers — direct link */}
                <Link
                  href="/offers"
                  className="py-3 border-b font-bold text-accent block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("offers")}
                </Link>

                {/* Contact — direct link */}
                <Link
                  href="/contact"
                  className="py-3 border-b font-bold text-accent block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("contact_engineer")}
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* --- MEGA MENU: PRODUCTS --- */}
        {activeMega === "productos" && (
          <div
            className="absolute top-20 left-0 w-full bg-card shadow-2xl border-t border-border flex animate-in fade-in slide-in-from-top-2 duration-200 z-50"
            onMouseEnter={() => setActiveMega("productos")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <div className="max-w-7xl mx-auto w-full flex min-h-[480px]">
              <div className="w-1/4 bg-secondary border-r border-border py-6">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onMouseEnter={() => setActiveL1(cat.id)}
                    className={`px-8 py-4 flex items-center justify-between cursor-pointer transition-all ${
                      activeL1 === cat.id
                        ? "bg-card text-accent font-bold border-r-2 border-accent shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="text-base">
                      {getLocalized(cat.content, locale).name}
                    </span>
                    <ChevronRight
                      size={14}
                      className={
                        activeL1 === cat.id ? "opacity-100" : "opacity-0"
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="w-3/4 p-10 grid grid-cols-3 gap-x-10 gap-y-8 overflow-y-auto content-start">
                {categories
                  .find((c) => c.id === activeL1)
                  ?.children.map((sub, idx) => (
                    <div key={idx} className="space-y-4">
                      <Link href={`/category/${sub.slug}`}>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b-2 border-accent pb-2 uppercase tracking-widest hover:text-accent transition-colors">
                          {getLocalized(sub.content, locale).name}
                        </h4>
                      </Link>
                      <div className="flex flex-col gap-2">
                        {sub.children?.map((child) => (
                          <Link
                            key={child.id}
                            href={`/category/${child.slug}`}
                            className="text-base text-muted-foreground hover:text-accent transition-colors pl-2 border-l border-border hover:border-accent"
                          >
                            {getLocalized(child.content, locale).name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* --- MEGA MENU: SOLUTIONS --- */}
        {activeMega === "soluciones" && (
          <div
            className="absolute top-20 left-0 w-full bg-card shadow-2xl border-t border-border py-10 animate-in fade-in slide-in-from-top-2 duration-200 z-50"
            onMouseEnter={() => setActiveMega("soluciones")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <div className="max-w-7xl mx-auto grid grid-cols-4 gap-8 px-4">
              {solColumns.map((col, idx) => (
                <div key={idx}>
                  <h4 className="font-bold text-foreground mb-4 text-base uppercase tracking-widest border-l-4 border-accent pl-3">
                    {col.title}
                  </h4>
                  <ul className="space-y-2">
                    {col.items.map((item, i) => (
                      <li key={i}>
                        <Link
                          href={item.href}
                          className="text-base text-muted-foreground hover:text-accent"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="bg-primary rounded-xl p-6 text-primary-foreground flex flex-col justify-between">
                <div>
                  <p className="text-accent font-bold text-sm uppercase mb-2">
                    {solPromo
                      ? getLocalizedStr(solPromo.badge, locale)
                      : t("special_projects")}
                  </p>
                  <h5 className="text-xl font-bold leading-tight">
                    {solPromo
                      ? getLocalizedStr(solPromo.heading, locale)
                      : t("custom_manufacturing")}
                  </h5>
                </div>
                <Link
                  href={solPromo?.buttonHref || "/contact"}
                  className="mt-4 bg-accent text-accent-foreground py-2 rounded font-bold text-sm uppercase text-center block"
                >
                  {solPromo
                    ? getLocalizedStr(solPromo.buttonText, locale)
                    : t("contact_engineer")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* --- MEGA MENU: RESOURCES --- */}
        {activeMega === "recursos" && (
          <div
            className="absolute top-20 left-0 w-full bg-card shadow-2xl border-t border-border py-10 animate-in fade-in slide-in-from-top-2 duration-200 z-50"
            onMouseEnter={() => setActiveMega("recursos")}
            onMouseLeave={() => setActiveMega(null)}
          >
            <div className="max-w-7xl mx-auto grid grid-cols-3 gap-12 px-4">
              {resColumns.map((col, idx) => (
                <div key={idx}>
                  <h4 className="font-bold text-foreground mb-4 text-base uppercase tracking-widest border-l-4 border-accent pl-3">
                    {col.title}
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {col.items.map((item, i) => {
                      const isExternal = item.href.startsWith("http") || item.href.endsWith(".pdf");
                      const linkClass = "flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors border border-transparent hover:border-border";
                      const content = (
                        <>
                          <div className="bg-accent/10 p-2 rounded text-accent">
                            <FileText size={18} />
                          </div>
                          <span className="text-base font-bold text-foreground/80">
                            {item.label}
                          </span>
                        </>
                      );
                      return isExternal ? (
                        <a
                          key={i}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          key={i}
                          href={item.href}
                          className={linkClass}
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent mb-4">
                  <Lightbulb size={32} />
                </div>
                <h5 className="font-bold text-foreground">
                  {t("knowledge_center")}
                </h5>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("knowledge_center_desc")}
                </p>
                <button className="mt-4 text-accent font-bold text-sm uppercase hover:underline">
                  {t("go_to_blog")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
