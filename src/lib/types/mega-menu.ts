export interface MegaMenuColumn {
  title: Record<string, string>; // { en: "By Industry", zh: "按行业" }
  items: MegaMenuItem[];
}

export interface MegaMenuItem {
  label: Record<string, string>; // { en: "Warehouses" }
  pageSlug?: string;  // CMS page link → /solutions/{slug}
  href?: string;      // Direct link (PDF, external URL) — mutually exclusive with pageSlug
}

export interface MegaMenuPromo {
  badge: Record<string, string>;
  heading: Record<string, string>;
  buttonText: Record<string, string>;
  buttonHref: string;
}

export interface MegaMenuData {
  columns: MegaMenuColumn[];
  promo?: MegaMenuPromo;
}
