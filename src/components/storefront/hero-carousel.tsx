"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner } from "./hero-banner";

// Define type matching the one in hero-banner props
type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  content: any;
};

interface HeroCarouselProps {
  banners: Banner[];
}

export function HeroCarousel({ banners }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [banners.length]);

  const next = () => setCurrent((prev) => (prev + 1) % banners.length);
  const prev = () =>
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length);

  if (banners.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden bg-primary">
      {/* Container with explicit height matching the banner height */}
      <div className="relative min-h-[897px]">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              index === current ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <HeroBanner banner={banner} />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full text-primary-foreground backdrop-blur-sm transition-colors border border-primary-foreground/20 hover:border-accent"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full text-primary-foreground backdrop-blur-sm transition-colors border border-primary-foreground/20 hover:border-accent"
            aria-label="Next slide"
          >
            <ChevronRight className="h-8 w-8" />
          </button>

          {/* Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === current
                    ? "bg-accent w-8"
                    : "bg-primary-foreground/50 hover:bg-primary-foreground/80"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
