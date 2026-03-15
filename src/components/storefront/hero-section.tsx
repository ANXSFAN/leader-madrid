"use client";

import { HeroCarousel } from "@/components/storefront/hero-carousel";
import { useTranslations } from "next-intl";

interface HeroSectionProps {
  banners: any[];
}

export function HeroSection({ banners }: HeroSectionProps) {
  const t = useTranslations("common");

  return (
    <section className="relative group z-10">
      <HeroCarousel banners={banners} />
    </section>
  );
}
