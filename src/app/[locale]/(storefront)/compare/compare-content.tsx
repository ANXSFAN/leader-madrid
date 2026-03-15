"use client";

import { useCompareStore } from "@/lib/store/compare";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { X, ShoppingCart, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatters";

const ALL_SPEC_KEYS = ["power", "cct", "cri", "ip", "beamAngle", "luminousFlux", "voltage", "dimmable", "lifespan", "material"];

const SPEC_LABELS: Record<string, string> = {
  power: "Power (W)",
  cct: "Color Temp (K)",
  cri: "CRI",
  ip: "IP Rating",
  beamAngle: "Beam Angle",
  luminousFlux: "Lumen Output",
  voltage: "Voltage",
  dimmable: "Dimmable",
  lifespan: "Lifespan (h)",
  material: "Material",
};

export function CompareContent({ currency }: { currency: string }) {
  const t = useTranslations("compare");
  const { products, remove, clear } = useCompareStore();
  const { data: session } = useSession();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isB2B = (session?.user as any)?.b2bStatus === "APPROVED";

  if (!mounted) return null;

  if (products.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h1>
          <p className="text-gray-500">{t("no_products")}</p>
        </div>
        <Link
          href={`/${locale}/search`}
          className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
        >
          {t("browse_catalog")}
        </Link>
      </div>
    );
  }

  const specKeys = ALL_SPEC_KEYS.filter((key) =>
    products.some((p) => p.specs?.[key] !== undefined)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("subtitle", { count: products.length })}
          </p>
        </div>
        <button
          onClick={clear}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <X size={14} />
          {t("clear_all")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <td className="w-40 p-3 bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t("col_product")}
              </td>
              {products.map((p) => (
                <td key={p.id} className="p-4 border border-gray-100 bg-white min-w-[200px]">
                  <div className="relative">
                    <button
                      onClick={() => remove(p.id)}
                      className="absolute -top-1 -right-1 p-1 bg-gray-100 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors"
                    >
                      <X size={12} />
                    </button>
                    <div className="relative h-36 mb-3 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          className="object-contain p-4"
                          sizes="200px"
                        />
                      ) : (
                        <span className="text-xs text-gray-300">{t("no_image")}</span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">{p.name}</h3>
                    <p className="text-xs font-mono text-gray-400 mb-3">SKU: {p.sku}</p>
                    <Link
                      href={`/${locale}/product/${p.slug}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {t("view_product")}
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr className="bg-yellow-50">
              <td className="p-3 border border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                {isB2B ? t("b2b_price_label") : t("price_label")}
              </td>
              {products.map((p) => {
                const price = isB2B && p.b2bPrice ? p.b2bPrice : p.price;
                const showOrig = isB2B && p.b2bPrice && p.b2bPrice < p.price;
                return (
                  <td key={p.id} className="p-4 border border-gray-100">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xl font-black text-gray-900">
                        {formatMoney(price, { locale, currency })}
                      </span>
                      {showOrig && (
                        <span className="text-xs line-through text-gray-400">
                          {formatMoney(p.price, { locale, currency })}
                        </span>
                      )}
                      {isB2B && (
                        <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded w-fit">
                          {t("wholesale_badge")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {specKeys.map((key) => (
              <tr key={key} className="hover:bg-gray-50 transition-colors">
                <td className="p-3 border border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                  {SPEC_LABELS[key] || key}
                </td>
                {products.map((p) => {
                  const val = p.specs?.[key];
                  return (
                    <td
                      key={p.id}
                      className={cn(
                        "p-4 border border-gray-100 text-sm font-medium",
                        val === undefined ? "text-gray-300" : "text-gray-900"
                      )}
                    >
                      {val !== undefined ? String(val) : t("na")}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr>
              <td className="p-3 border border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                {t("col_actions")}
              </td>
              {products.map((p) => (
                <td key={p.id} className="p-4 border border-gray-100">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/${locale}/product/${p.slug}`}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <ShoppingCart size={13} />
                      {isB2B ? t("order_now") : t("add_to_cart")}
                    </Link>
                    {isB2B && (
                      <Link
                        href={`/${locale}/rfq?product=${p.id}`}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded-lg transition-colors"
                      >
                        <FileText size={13} />
                        {t("request_quote")}
                      </Link>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
