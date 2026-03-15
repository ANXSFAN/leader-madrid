"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { getLocalized } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

type CategoryChild = {
  id: string;
  slug: string;
  content: Record<string, unknown>;
  _count: { products: number };
};

type CategoryWithChildren = {
  id: string;
  slug: string;
  content: Record<string, unknown>;
  children: CategoryChild[];
  _count: { products: number };
};

interface CatalogBrowserProps {
  categories: CategoryWithChildren[];
}

export function CatalogBrowser({ categories }: CatalogBrowserProps) {
  const locale = useLocale();
  const t = useTranslations("catalog_page");
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");

  const active = categories.find((c) => c.id === activeId);
  const activeContent = active ? getLocalized(active.content, locale) : null;

  const getRawImage = (content: Record<string, unknown>): string | undefined => {
    const c = content as Record<string, unknown>;
    return (c?.imageUrl as string) ||
    (c?.images as string[] | undefined)?.[0] ||
    (c?.[locale] as Record<string, string> | undefined)?.image ||
    (c?.en as Record<string, string> | undefined)?.image;
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-h,56px)-56px)] md:h-auto md:min-h-[600px]">
      {/* Left Sidebar — top-level categories */}
      <aside className="w-[88px] md:w-[200px] shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
        {/* View all products link */}
        <Link
          href="/search"
          className="w-full flex flex-col items-center gap-1.5 px-2 py-3 md:flex-row md:gap-3 md:px-4 md:py-3.5 text-center md:text-left transition-colors text-muted-foreground hover:bg-background/50 hover:text-foreground border-b border-border/50"
        >
          <div className="relative w-10 h-10 md:w-9 md:h-9 rounded-lg bg-accent/10 shrink-0 overflow-hidden border border-accent/20 flex items-center justify-center">
            <ChevronRight size={18} className="text-accent" />
          </div>
          <span className="text-[11px] md:text-sm leading-tight line-clamp-2 font-medium">
            {t("view_all")}
          </span>
        </Link>

        {categories.map((cat) => {
          const content = getLocalized(cat.content, locale);
          const isActive = cat.id === activeId;
          const imageUrl = getRawImage(cat.content);

          return (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              className={cn(
                "w-full flex flex-col items-center gap-1.5 px-2 py-3 md:flex-row md:gap-3 md:px-4 md:py-3.5 text-center md:text-left transition-colors relative",
                isActive
                  ? "bg-background text-accent font-semibold"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-accent rounded-r-full" />
              )}

              {/* Icon / Image */}
              <div className="relative w-10 h-10 md:w-9 md:h-9 rounded-lg bg-white shrink-0 overflow-hidden border border-border/50">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={content.name}
                    fill
                    className="object-contain p-1"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      {content.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Name */}
              <span className="text-[11px] md:text-sm leading-tight line-clamp-2">
                {content.name}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Right Content — subcategories */}
      <main className="flex-1 overflow-y-auto bg-background">
        {active && activeContent && (
          <div className="p-4 md:p-6">
            {/* Category header */}
            <div className="mb-4">
              <Link
                href={`/category/${active.slug}`}
                className="group inline-block"
              >
                <h2 className="text-lg md:text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                  {activeContent.name}
                </h2>
              </Link>
              {activeContent.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {activeContent.description}
                </p>
              )}
            </div>

            {/* Subcategory grid */}
            {active.children.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {active.children.map((child) => {
                  const childContent = getLocalized(child.content, locale);
                  const childImage = getRawImage(child.content);

                  return (
                    <Link
                      key={child.id}
                      href={`/category/${child.slug}`}
                      className="group/item flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-sm transition-all"
                    >
                      <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-lg bg-muted/50 overflow-hidden">
                        {childImage ? (
                          <Image
                            src={childImage}
                            alt={childContent.name}
                            fill
                            className="object-contain p-1.5 group-hover/item:scale-110 transition-transform duration-300"
                            sizes="56px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-lg font-bold text-muted-foreground/60">
                              {childContent.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs md:text-sm text-center text-foreground/80 group-hover/item:text-accent font-medium line-clamp-2 leading-tight transition-colors">
                        {childContent.name}
                      </span>
                      {child._count.products > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {child._count.products}
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* View all — inside grid, last position */}
                <Link
                  href={`/category/${active.slug}`}
                  className="group/item flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-accent/5 border border-accent/20 hover:bg-accent/10 hover:border-accent/40 transition-all"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-accent/10 flex items-center justify-center">
                    <ChevronRight size={20} className="text-accent" />
                  </div>
                  <span className="text-xs md:text-sm text-center text-accent font-medium leading-tight">
                    {t("all_products")}
                  </span>
                </Link>
              </div>
            ) : (
              /* No subcategories — show direct link */
              <Link
                href={`/category/${active.slug}`}
                className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-accent/30 transition-all"
              >
                <span className="text-sm font-medium text-foreground">
                  {t("all_products")}
                </span>
                <ChevronRight
                  size={16}
                  className="text-muted-foreground"
                />
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
