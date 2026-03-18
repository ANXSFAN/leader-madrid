import { Category } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { getLocalized } from "@/lib/content";
import { useLocale, useTranslations } from "next-intl";

import Image from "next/image";

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const viewAllText = locale === "es" ? "Ver todo" : "View all";

  return (
    <section className="container py-16">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-foreground mb-4">
          {t("popular_categories")}
        </h2>
        <div className="w-20 h-1.5 bg-accent mx-auto rounded-full" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-6">
        {categories.map((category) => {
          const content = getLocalized(category.content, locale);
          const rawContent = category.content as any;
          const imageUrl =
            rawContent?.imageUrl ||
            rawContent?.images?.[0] ||
            rawContent?.[locale as string]?.image ||
            rawContent?.en?.image;

          return (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="group block h-full"
            >
              <div className="h-full flex flex-col items-center p-6 bg-muted/50 rounded-2xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
                {/* Image Area */}
                <div className="relative w-full aspect-[4/3] mb-4 flex items-center justify-center">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={content.name}
                      fill
                      className="object-contain p-2 group-hover:scale-110 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-card rounded-xl">
                      <span className="text-5xl font-bold text-muted-foreground">
                        {content.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Text Area */}
                <div className="flex flex-col items-center text-center w-full space-y-2">
                  <h3 className="font-bold text-xl text-foreground line-clamp-2 group-hover:text-foreground transition-colors">
                    {content.name}
                  </h3>

                  <div className="h-6 overflow-hidden">
                    <span className="block text-base font-bold transform translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 text-accent">
                      {viewAllText} →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
