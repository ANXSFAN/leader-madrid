"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Home,
  Grid3X3,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useEffect, useState } from "react";
import { MobileSearchOverlay } from "./mobile-search-overlay";

interface BottomNavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}

function BottomNavItem({
  href,
  icon: Icon,
  label,
  isActive,
  badge,
  onClick,
}: BottomNavItemProps) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors relative",
          isActive
            ? "text-accent"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className="relative">
          <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className="text-[11px] font-medium">{label}</span>
        {isActive && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
        )}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors relative",
        isActive
          ? "text-accent"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="relative">
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium">{label}</span>
      {isActive && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
      )}
    </Link>
  );
}

export function BottomNavigation() {
  const t = useTranslations("navbar");
  const pathname = usePathname();
  const { items } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close search overlay when navigating
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  const cartCount = mounted
    ? items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Search Overlay */}
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="flex items-center h-14">
          <BottomNavItem
            href="/"
            icon={Home}
            label={t("home")}
            isActive={isActive("/")}
          />
          <BottomNavItem
            href="/category"
            icon={Grid3X3}
            label={t("catalog")}
            isActive={isActive("/category")}
          />
          <BottomNavItem
            href="/search"
            icon={Search}
            label={t("search")}
            isActive={searchOpen || isActive("/search")}
            onClick={() => setSearchOpen(!searchOpen)}
          />
          <BottomNavItem
            href="/cart"
            icon={ShoppingCart}
            label={t("cart")}
            isActive={isActive("/cart")}
            badge={cartCount}
          />
          <BottomNavItem
            href="/profile"
            icon={User}
            label={t("profile")}
            isActive={isActive("/profile")}
          />
        </div>
      </nav>
    </>
  );
}
