"use client";

import {
  Shield,
  Check,
  Zap,
  Sun,
  Truck,
  RotateCcw,
  Headphones,
  Award,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface TrustItem {
  icon: string;
  title: string;
  subtitle: string;
}

interface TrustSectionProps {
  trustItems?: TrustItem[];
}

const defaultTrustItems = [
  {
    icon: "shield",
    title: "warranty_5_years",
    subtitle: "drivers_philips_meanwell",
  },
  {
    icon: "check",
    title: "certified_ce_rohs",
    subtitle: "tuv_sud_verified",
  },
  {
    icon: "zap",
    title: "energy_saving",
    subtitle: "up_to_160_lmw",
  },
  {
    icon: "sun",
    title: "high_cri",
    subtitle: "real_comfortable_light",
  },
  {
    icon: "truck",
    title: "free_shipping",
    subtitle: "orders_over_100",
  },
  {
    icon: "rotate",
    title: "easy_returns",
    subtitle: "days_guarantee",
  },
];

const iconMap: Record<string, any> = {
  shield: Shield,
  check: Check,
  zap: Zap,
  sun: Sun,
  truck: Truck,
  rotate: RotateCcw,
  headphones: Headphones,
  award: Award,
};

export function TrustSection({ trustItems }: TrustSectionProps) {
  const t = useTranslations("home");

  const items = trustItems || defaultTrustItems;

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t("why_choose_us")}
          </h2>
          <div className="w-20 h-1.5 bg-accent mx-auto mb-6 rounded-full" />
          <p className="text-muted-foreground max-w-3xl mx-auto text-xl leading-relaxed">
            {t("trust_description")}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {items.map((item, idx) => {
            const IconComponent = iconMap[item.icon] || Shield;
            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-3 group p-6 rounded-xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-muted-foreground mb-2 group-hover:bg-primary group-hover:text-accent transition-all duration-300">
                  <IconComponent size={28} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-foreground text-center text-lg leading-tight">
                  {t.has(item.title) ? t(item.title) : item.title}
                </h3>
                <p className="text-base text-muted-foreground text-center">
                  {t.has(item.subtitle) ? t(item.subtitle) : item.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
