"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Category } from "@prisma/client";
import { getLocalized } from "@/lib/content";
import { useTranslations, useLocale } from "next-intl";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Package,
  Zap,
  Lightbulb,
  Clock,
  Shield,
} from "lucide-react";

interface MobileMenuProps {
  categories: (Category & { children: Category[] })[];
}

const categoryIcons: Record<string, any> = {
  "iluminacion-led": Zap,
  "bombillas-led": Lightbulb,
  "paneles-led": Package,
  "tiras-led": Zap,
  "proyectores-led": Zap,
  default: Package,
};

function getCategoryIcon(slug: string) {
  return categoryIcons[slug] || categoryIcons.default;
}

export function MobileMenu({ categories }: MobileMenuProps) {
  const t = useTranslations("navbar");
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null
  );

  const handleCategoryClick = (cat: Category & { children: Category[] }) => {
    if (cat.children && cat.children.length > 0) {
      setActiveCategory(cat.id);
    }
  };

  const handleSubcategoryClick = (subcat: Category) => {
    setActiveSubcategory(subcat.id);
  };

  const handleBack = () => {
    if (activeSubcategory) {
      setActiveSubcategory(null);
    } else if (activeCategory) {
      setActiveCategory(null);
    }
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveCategory(null);
    setActiveSubcategory(null);
  };

  const renderCategories = (cats: (Category & { children: Category[] })[]) => (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t("categories")}</h2>
      </div>
      <div className="space-y-1">
        {cats.map((cat) => {
          const Icon = getCategoryIcon(cat.slug);
          const hasChildren = cat.children && cat.children.length > 0;
          return (
            <div key={cat.id}>
              <div
                className={`flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${
                  hasChildren
                    ? "cursor-pointer hover:bg-muted"
                    : "hover:bg-muted"
                }`}
                onClick={() => handleCategoryClick(cat)}
              >
                <Link
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 flex-1"
                  onClick={(e) => hasChildren && e.preventDefault()}
                >
                  <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-medium text-foreground">
                    {getLocalized(cat.content, locale).name}
                  </span>
                </Link>
                {hasChildren && (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-4 border-t border-border">
        <Link
          href="/apply-b2b"
          className="flex items-center gap-3 py-3 px-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
          onClick={closeMenu}
        >
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-accent">{t("request_b2b")}</span>
        </Link>
      </div>
    </div>
  );

  const renderSubcategories = (cat: Category & { children: Category[] }) => (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Volver</span>
        </button>
      </div>
      <h2 className="text-xl font-bold text-foreground mb-4 px-3">
        {getLocalized(cat.content, locale).name}
      </h2>
      <div className="space-y-1">
        {cat.children.map((child) => (
          <Link
            key={child.id}
            href={`/category/${child.slug}`}
            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted transition-colors"
            onClick={closeMenu}
          >
            <span className="font-medium text-foreground">
              {getLocalized(child.content, locale).name}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );

  const renderChildDetails = (
    parentCat: Category & { children: Category[] },
    childCat: Category
  ) => {
    const childWithParent = {
      ...parentCat.children.find((c) => c.id === childCat.id),
      children: [],
    } as Category & { children: Category[] };

    return renderSubcategories({ ...childCat, children: [] } as Category & {
      children: Category[];
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu size={24} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <div className="h-full overflow-y-auto">
          <div className="p-4">
            {!activeCategory &&
              !activeSubcategory &&
              renderCategories(categories)}

            {activeCategory &&
              !activeSubcategory &&
              renderSubcategories(
                categories.find((c) => c.id === activeCategory)!
              )}

            {activeCategory &&
              activeSubcategory &&
              renderSubcategories(
                categories.find((c) => c.id === activeCategory)!
              )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
