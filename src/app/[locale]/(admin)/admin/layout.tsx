import { AdminShell } from "@/components/admin/admin-shell";
import { getModuleToggles } from "@/lib/actions/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabledModules = await getModuleToggles();
  return <AdminShell enabledModules={enabledModules}>{children}</AdminShell>;
}
