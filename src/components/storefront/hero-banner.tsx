"use client";

import React from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  FileDown,
  CheckCircle,
  Truck,
  Globe,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BannerContent, LocalizedString } from "@/lib/actions/cms";
import { cn } from "@/lib/utils";

// Map string icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  ShieldCheck,
  Zap,
  BarChart3,
  FileDown,
  ArrowRight,
  CheckCircle,
  Truck,
  Globe,
};

function resolveLocalizedString(
  field: LocalizedString | undefined,
  locale: string,
  fallback = ""
): string {
  if (!field) return fallback;
  if (typeof field === "string") return field;
  return field[locale] || field["en"] || Object.values(field)[0] || fallback;
}

interface HeroBannerProps {
  banner: {
    id: string;
    title: string;
    imageUrl: string;
    content: any; // Using any because it comes from JSON
  };
}

export function HeroBanner({ banner }: HeroBannerProps) {
  const locale = useLocale();
  const content = (banner.content || {}) as BannerContent;

  const rf = (field: LocalizedString | undefined, fb = "") =>
    resolveLocalizedString(field, locale, fb);

  // Destructure non-localized fields with defaults
  const {
    highlightColor = "text-accent",
    buttons = [],
    stats = [],
    alignment = "left",
  } = content;

  // Resolve localized fields
  const badge = rf(content.badge);
  const heading = rf(content.heading, banner.title);
  const description = rf(content.description);

  return (
    <div className="w-full relative min-h-[520px] md:min-h-[700px] lg:min-h-[897px] flex items-center overflow-hidden font-sans bg-black">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src={banner.imageUrl}
          alt={banner.title}
          fill
          sizes="100vw"
          className="object-cover"
          priority
          unoptimized={banner.imageUrl.endsWith(".svg")}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        {/* Subtle Texture/Pattern Overlay (Optional) */}
        <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.svg')] mix-blend-overlay" />
      </div>

      <div
        className={cn(
          "container mx-auto px-4 w-full relative z-10 py-20",
          alignment === "center"
            ? "flex flex-col items-center text-center"
            : "grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        )}
      >
        {/* Content Area */}
        <div
          className={cn(
            "space-y-8 animate-fade-in-up",
            alignment === "center" ? "max-w-4xl mx-auto" : "lg:col-span-8"
          )}
        >
          {/* Badge */}
          {badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-accent/30 bg-accent/10 text-accent text-[12px] font-bold tracking-[0.2em] uppercase rounded-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {badge}
            </div>
          )}

          {/* Heading */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight"
            dangerouslySetInnerHTML={{
              __html: heading.replace(
                /\{highlight\}(.*?)\{\/highlight\}/g,
                `<span class="${highlightColor}">$1</span>`
              ),
            }}
          />

          {/* Description */}
          {description && (
            <p
              className={cn(
                "text-xl md:text-2xl text-primary-foreground/70 font-light leading-relaxed max-w-2xl",
                alignment === "center" && "mx-auto"
              )}
            >
              {description}
            </p>
          )}

          {/* Buttons */}
          {buttons && buttons.length > 0 && (
            <div
              className={cn(
                "flex flex-col sm:flex-row gap-4 pt-4",
                alignment === "center" && "justify-center"
              )}
            >
              {buttons.map((btn, idx) => (
                <Button
                  key={idx}
                  asChild
                  size="lg"
                  variant={btn.variant === "outline" ? "outline" : "default"}
                  className={cn(
                    "text-lg px-8 py-6 h-auto font-bold tracking-wide transition-all duration-300 ease-out",
                    btn.variant === "primary"
                      ? "bg-accent text-accent-foreground border-none shadow-[0_0_20px_-5px_rgba(234,179,8,0.3)] hover:bg-accent/85 hover:shadow-[0_0_30px_-3px_rgba(234,179,8,0.5)] hover:scale-[1.03] active:scale-[0.98]"
                      : "bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground hover:scale-[1.03] active:scale-[0.98]"
                  )}
                >
                  <Link href={btn.link}>
                    {rf(btn.text)}
                    {idx === 0 && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Link>
                </Button>
              ))}
            </div>
          )}

          {/* Stats Section */}
          {stats && stats.length > 0 && (
            <div
              className={cn(
                "grid grid-cols-2 sm:grid-cols-3 gap-6 pt-8 mt-8 border-t border-white/10",
                alignment === "center"
                  ? "justify-center text-left max-w-3xl mx-auto"
                  : ""
              )}
            >
              {stats.map((stat, idx) => {
                const Icon = iconMap[stat.icon] || CheckCircle;
                return (
                  <div key={idx} className="flex items-center gap-3 group">
                    <div className="p-2.5 bg-primary-foreground/5 rounded-lg text-accent border border-primary-foreground/5 group-hover:border-accent/30 transition-colors">
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-primary-foreground font-bold text-xl leading-none mb-1">
                        {rf(stat.value)}
                      </div>
                      <div className="text-primary-foreground/50 text-[11px] uppercase tracking-wider font-medium">
                        {rf(stat.label)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
