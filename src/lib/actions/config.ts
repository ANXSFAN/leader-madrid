"use server";

import db from "@/lib/db";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth-guard";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface SiteSettingsData {
  siteName: string;
  logoUrl?: string;
  contactEmail: string;
  phoneNumber: string;
  whatsapp?: string;
  address: string;
  catalogUrl?: string;
  sellerTaxId?: string;
  currency: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
  };
  footerColumns?: FooterColumn[];
}

const DEFAULT_SETTINGS: SiteSettingsData = {
  siteName: "Leader Madrid",
  contactEmail: "info@example.com",
  phoneNumber: "+1 555 000 0000",
  whatsapp: "+1 555 000 0001",
  address: "123 Industrial Park, City, Country",
  catalogUrl: "/catalog.pdf",
  sellerTaxId: "A00000001",
  currency: "EUR",
  socialLinks: {
    facebook: "https://facebook.com/ledstore",
    instagram: "https://instagram.com/ledstore",
    linkedin: "https://linkedin.com/company/ledstore",
  },
  // footerColumns omitted: footer.tsx uses t() translations as default columns
};

export async function getGlobalConfig(key: string) {
  const getCachedConfig = unstable_cache(
    async () => {
      // @ts-ignore - Prisma client might not be fully updated in IDE types yet
      const config = await db.globalConfig.findUnique({
        where: { key },
      });
      return config?.value || null;
    },
    [`config-${key}`],
    { tags: [`config-${key}`] }
  );

  return getCachedConfig();
}

export async function getSiteSettings(): Promise<SiteSettingsData> {
  const data = await getGlobalConfig("site_settings");
  if (!data) return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...(data as Partial<SiteSettingsData>) };
  return { ...merged, currency: merged.currency ?? DEFAULT_SETTINGS.currency };
}

// ── Theme Config ──────────────────────────────────────────────────────
export interface ThemeConfig {
  preset: string;   // 'default' | 'ocean' | 'forest' | 'sunset' | 'slate'
  primary: string;  // HSL e.g. "222 47% 11%"
  accent: string;   // HSL e.g. "40 90% 55%"
  radius: string;   // e.g. "0.5rem"
}

const DEFAULT_THEME: ThemeConfig = {
  preset: "default",
  primary: "222 47% 11%",
  accent: "40 90% 55%",
  radius: "0.5rem",
};

export async function getThemeConfig(): Promise<ThemeConfig> {
  const data = await getGlobalConfig("theme_config");
  if (!data) return DEFAULT_THEME;
  return { ...DEFAULT_THEME, ...(data as Partial<ThemeConfig>) };
}

export async function updateThemeConfig(config: ThemeConfig) {
  return updateGlobalConfig("theme_config", config);
}

// ── Module Toggles ───────────────────────────────────────────────────
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules";

export type ModuleToggles = Record<ModuleKey, boolean>;

const DEFAULT_MODULE_TOGGLES: ModuleToggles = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, true])
) as ModuleToggles;

export async function getModuleToggles(): Promise<ModuleToggles> {
  const data = await getGlobalConfig("module_toggles");
  if (!data) return DEFAULT_MODULE_TOGGLES;
  return { ...DEFAULT_MODULE_TOGGLES, ...(data as Partial<ModuleToggles>) };
}

export async function updateModuleToggles(toggles: ModuleToggles) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const { isSuperAdmin } = await import("@/lib/super-admin");
  if (!isSuperAdmin(session.user?.email)) {
    return { error: "Unauthorized" };
  }

  return updateGlobalConfig("module_toggles", toggles);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateGlobalConfig(key: string, value: any) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  // @ts-ignore
  await db.globalConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  revalidateTag(`config-${key}`, "default");
  return { success: true };
}
