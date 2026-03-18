"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { createRFQ } from "@/lib/actions/rfq";
import {
  searchProductsForRFQ,
  type RFQProductResult,
} from "@/lib/actions/search";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  Search,
  Package,
  User,
  MessageSquare,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

interface RFQItem {
  productId: string;
  productName: string;
  variantSku?: string;
  quantity: number;
  targetPrice: string;
}

const COUNTRIES = [
  "ES", "FR", "DE", "IT", "PT", "NL", "PL", "GB", "BE", "AT", "CH", "CN", "US", "OTHER",
] as const;

/* ─── Product Search Autocomplete ─── */
function ProductSearchInput({
  value,
  locale,
  isB2B,
  t,
  onSelect,
  onChange,
}: {
  value: string;
  locale: string;
  isB2B: boolean;
  t: (key: string) => string;
  onSelect: (product: RFQProductResult) => void;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<RFQProductResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchProductsForRFQ(query, locale);
        setResults(res);
        setIsOpen(res.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, locale]);

  // click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="w-full border border-border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          placeholder={t("placeholder_product")}
        />
        {searching && (
          <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((product) => (
            <button
              key={product.productId}
              type="button"
              onClick={() => {
                onSelect(product);
                setQuery(product.productName);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-accent/5 transition-colors border-b border-border/50 last:border-0 flex items-center gap-3"
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Package size={16} className="text-muted-foreground/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {product.productName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {product.productSku && <span>SKU: {product.productSku}</span>}
                  {product.variants.length > 0 && (
                    <span className="font-semibold text-accent">
                      €{(isB2B && product.variants[0].b2bPrice
                        ? product.variants[0].b2bPrice
                        : product.variants[0].price
                      ).toFixed(2)}
                      {t("per_unit")}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {results.length === 0 && !searching && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {t("search_no_results")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main RFQ Page ─── */
export default function RFQPage() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("rfq");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<RFQItem[]>([
    { productId: "", productName: "", variantSku: "", quantity: 1, targetPrice: "" },
  ]);

  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    companyName: "",
    phone: "",
    country: "ES",
    message: "",
  });

  useEffect(() => {
    if (session?.user) {
      const u = session.user as any;
      setForm((f) => ({
        ...f,
        contactName: u.name || "",
        contactEmail: u.email || "",
        companyName: u.companyName || "",
        phone: u.phone || "",
      }));
    }
  }, [session]);

  const isB2B = (session?.user as any)?.b2bStatus === "APPROVED";

  const updateItem = useCallback(
    (index: number, field: keyof RFQItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      { productId: "", productName: "", variantSku: "", quantity: 1, targetPrice: "" },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleProductSelect(index: number, product: RFQProductResult) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const variant = product.variants[0];
        return {
          ...item,
          productId: product.productId,
          productName: product.productName,
          variantSku: variant?.sku || product.productSku,
          targetPrice:
            isB2B && variant?.b2bPrice
              ? variant.b2bPrice.toFixed(2)
              : variant
                ? variant.price.toFixed(2)
                : item.targetPrice,
        };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter((item) => item.productName.trim());
    if (validItems.length === 0) {
      toast.error(t("error_no_products"));
      return;
    }

    setLoading(true);
    try {
      const res = await createRFQ({
        ...form,
        items: validItems.map((item) => ({
          productId: item.productId || "manual",
          productName: item.productName,
          variantSku: item.variantSku || undefined,
          quantity: item.quantity,
          targetPrice: item.targetPrice ? parseFloat(item.targetPrice) : undefined,
        })),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  /* ─── Success Screen ─── */
  if (submitted) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center ring-8 ring-green-50/50">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("success_title")}</h1>
          <p className="text-muted-foreground max-w-md">{t("success_desc")}</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Link
            href="/"
            className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            {t("back_home")}
          </Link>
          <Link
            href="/search"
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-bold transition-colors"
          >
            {t("continue_shopping")}
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Form ─── */
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-11 w-11 bg-accent/10 rounded-xl flex items-center justify-center">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isB2B ? t("b2b_title") : t("title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isB2B ? t("b2b_subtitle") : t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── Contact Section ─── */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-secondary/60 border-b border-border flex items-center gap-2">
            <User size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {t("contact_section")}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t("full_name")} <span className="text-destructive/70">*</span>
                </label>
                <input
                  required
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t("placeholder_name")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t("email")} <span className="text-destructive/70">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t("placeholder_email")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t("company")}
                </label>
                <input
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t("placeholder_company")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t("phone")}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t("placeholder_phone")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t("country")}
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full sm:w-1/2 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent bg-card"
                >
                  {COUNTRIES.map((code) => (
                    <option key={code} value={code}>
                      {t(`country_${code}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Products Section ─── */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-secondary/60 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                {t("products_section")}
              </h2>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-semibold transition-colors bg-accent/5 hover:bg-accent/10 px-3 py-1.5 rounded-lg"
            >
              <Plus size={13} />
              {t("add_item")}
            </button>
          </div>

          <div className="p-6 space-y-4">
            {items.map((item, i) => (
              <div
                key={i}
                className="relative bg-secondary/80 rounded-xl p-4 border border-border"
              >
                {/* Item number badge & delete */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground/60 uppercase">
                    {t("item_number", { number: i + 1 })}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title={t("remove_item")}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Product search */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    {t("product_ref")} <span className="text-destructive/70">*</span>
                  </label>
                  <ProductSearchInput
                    value={item.productName}
                    locale={locale}
                    isB2B={isB2B}
                    t={t}
                    onSelect={(product) => handleProductSelect(i, product)}
                    onChange={(val) => updateItem(i, "productName", val)}
                  />
                </div>

                {/* Qty + Price row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      {t("quantity")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      {t("target_price")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.targetPrice}
                      onChange={(e) => updateItem(i, "targetPrice", e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      placeholder={t("placeholder_price")}
                    />
                  </div>
                </div>

                {/* show selected variant SKU if available */}
                {item.variantSku && item.productId && (
                  <p className="mt-2 text-xs text-muted-foreground/60">
                    SKU: {item.variantSku}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Notes Section ─── */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-secondary/60 border-b border-border flex items-center gap-2">
            <MessageSquare size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {t("notes_section")}
            </h2>
          </div>
          <div className="p-6">
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              placeholder={t("message_placeholder")}
            />
          </div>
        </section>

        {/* ─── Submit ─── */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-black text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {loading ? t("submitting") : t("submit")}
        </button>

        {/* Response time note */}
        <p className="text-center text-xs text-muted-foreground/60">{t("response_note")}</p>
      </form>
    </div>
  );
}
