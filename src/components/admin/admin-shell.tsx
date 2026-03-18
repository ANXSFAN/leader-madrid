"use client";

import { useState } from "react";
import { AdminSidebar } from "./sidebar";
import { AdminHeader } from "./header";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AdminShell({ children, enabledModules, logoUrl, siteName }: { children: React.ReactNode; enabledModules?: Record<string, boolean>; logoUrl?: string; siteName?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      {/* Desktop sidebar */}
      <AdminSidebar enabledModules={enabledModules} logoUrl={logoUrl} siteName={siteName} />

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-slate-900">
          <AdminSidebar mobile onNavigate={() => setMobileOpen(false)} enabledModules={enabledModules} logoUrl={logoUrl} siteName={siteName} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col w-full">
        <AdminHeader onMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
