"use client";

import { Bell, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface AdminHeaderProps {
  onMenuToggle?: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const t = useTranslations("admin.common");

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6 shadow-sm">
      {onMenuToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-slate-600"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      )}
      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder={t("actions.search_placeholder")}
              className="w-full bg-slate-50 pl-8 md:w-[300px] lg:w-[400px] focus-visible:border-yellow-400 focus-visible:ring-yellow-200"
            />
          </div>
        </form>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-yellow-500 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">{t("notifications.label")}</span>
        </Button>
        <div className="h-9 w-9 rounded-lg bg-yellow-500 flex items-center justify-center shadow-sm cursor-pointer hover:bg-yellow-600 transition-colors">
          <span className="text-gray-900 font-black text-sm">A</span>
        </div>
      </div>
    </header>
  );
}
