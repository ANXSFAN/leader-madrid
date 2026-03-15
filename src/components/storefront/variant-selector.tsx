"use client";

import { ProductVariant } from "@prisma/client";

type ProductSpecs = Record<string, any>;
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: string;
  onVariantChange: (id: string) => void;
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onVariantChange,
}: VariantSelectorProps) {
  const t = useTranslations("product");
  const tAttributes = useTranslations("attributes");

  const getVariantType = (variant: ProductVariant): "color" | "size" | "CCT" | "power" | "default" => {
    const specs = variant.specs as ProductSpecs;
    if (specs.color) return "color";
    if (specs.size) return "size";
    if (specs.cct) return "CCT";
    if (specs.power) return "power";
    return "default";
  };

  const getVariantLabel = (variant: ProductVariant) => {
    const specs = variant.specs as ProductSpecs;
    if (specs.color) return specs.color;
    if (specs.size) return specs.size;
    if (specs.cct) return specs.cct;
    if (specs.power) return specs.power;
    return variant.sku.split("-").pop() || variant.sku;
  };

  const getColorValue = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      white: "#FFFFFF",
      warmwhite: "#FFF5E6",
      coolwhite: "#F5F5FF",
      daylight: "#E6F0FF",
      red: "#FF4444",
      green: "#44AA44",
      blue: "#4444FF",
      yellow: "#FFDD44",
      amber: "#FFAA00",
      pink: "#FF88AA",
      purple: "#AA44FF",
      black: "#1A1A1A",
      silver: "#C0C0C0",
      gray: "#808080",
      grey: "#808080",
    };
    const normalized = colorName.toLowerCase().replace(/\s+/g, "");
    return colorMap[normalized] || colorName;
  };

  const variantType = variants.length > 0 ? getVariantType(variants[0]) : "default";
  const hasSufficientStock = (variant: ProductVariant) => (variant.physicalStock || 0) > 0;

  if (variantType === "color") {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground mb-3 uppercase tracking-wide">
          {t("select_color")}
        </h3>
        <div className="flex flex-wrap gap-3">
          {variants.map((variant) => {
            const isSelected = variant.id === selectedVariantId;
            const specs = variant.specs as ProductSpecs;
            const colorValue = specs.color ? getColorValue(specs.color) : "#ccc";
            const isOutOfStock = !hasSufficientStock(variant);

            return (
              <button
                key={variant.id}
                onClick={() => onVariantChange(variant.id)}
                disabled={isOutOfStock}
                className={cn(
                  "relative w-12 h-12 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent",
                  isSelected && "ring-2 ring-accent ring-offset-2",
                  isOutOfStock && "opacity-40 cursor-not-allowed"
                )}
                style={{ backgroundColor: colorValue }}
                title={specs.color}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-3 h-3 bg-white rounded-full shadow-sm" />
                  </span>
                )}
                {isOutOfStock && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="absolute w-14 h-0.5 bg-red-500 rotate-45" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedVariantId && (
          <p className="text-base text-muted-foreground">
            <span className="font-medium">{t("selected")}:</span>{" "}
            {(variants.find((v) => v.id === selectedVariantId)?.specs as ProductSpecs)?.color}
          </p>
        )}
      </div>
    );
  }

  if (variantType === "size") {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground mb-3 uppercase tracking-wide">
          {t("select_size")}
        </h3>
        <div className="flex flex-wrap gap-3">
          {variants.map((variant) => {
            const isSelected = variant.id === selectedVariantId;
            const specs = variant.specs as ProductSpecs;
            const isOutOfStock = !hasSufficientStock(variant);

            return (
              <button
                key={variant.id}
                onClick={() => onVariantChange(variant.id)}
                disabled={isOutOfStock}
                className={cn(
                  "min-w-[64px] h-12 px-4 rounded-lg border-2 text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent",
                  isSelected
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border",
                  isOutOfStock && "opacity-40 cursor-not-allowed line-through"
                )}
              >
                {specs.size}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variantType === "CCT" || variantType === "power") {
    const label = variantType === "CCT" ? t("select_cct") : t("select_power");
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground mb-3 uppercase tracking-wide">
          {label}
        </h3>
        <div className="flex flex-wrap gap-3">
          {variants.map((variant) => {
            const isSelected = variant.id === selectedVariantId;
            const specs = variant.specs as ProductSpecs;
            const label = variantType === "CCT" ? specs.cct : specs.power;
            const isOutOfStock = !hasSufficientStock(variant);

            return (
              <button
                key={variant.id}
                onClick={() => onVariantChange(variant.id)}
                disabled={isOutOfStock}
                className={cn(
                  "min-w-[80px] h-12 px-5 rounded-lg border-2 text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent",
                  isSelected
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border",
                  isOutOfStock && "opacity-40 cursor-not-allowed line-through"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground mb-3 uppercase tracking-wide">
        {t("select_variant")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedVariantId;
          const isOutOfStock = !hasSufficientStock(variant);

          return (
            <button
              key={variant.id}
              onClick={() => onVariantChange(variant.id)}
              disabled={isOutOfStock}
              className={cn(
                "px-4 py-2 rounded-lg border-2 text-base font-medium transition-all duration-200 min-w-[80px]",
                isSelected
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border",
                isOutOfStock && "opacity-40 cursor-not-allowed"
              )}
            >
              {variant.sku.split("-").pop()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
