import { AdminShell } from "@/components/admin/admin-shell";
import { getModuleToggles, getSiteSettings } from "@/lib/actions/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabledModules, siteSettings] = await Promise.all([
    getModuleToggles(),
    getSiteSettings(),
  ]);
  return (
    <AdminShell enabledModules={enabledModules} logoUrl={siteSettings.logoUrl} siteName={siteSettings.siteName}>
      {children}
    </AdminShell>
  );
}
