/**
 * Module visibility configuration.
 * Toggles are stored in GlobalConfig ("module_toggles") and managed via Admin Settings.
 * This file provides type definitions and the module key list.
 */

export const MODULE_KEYS = [
  "dashboard",
  "products",
  "orders",
  "purchasing",
  "inventory",
  "suppliers",
  "shipping",
  "customs",
  "approvals",
  "reorder_suggestions",
  "inventory_reports",
  "reports",
  "finance",
  "customers",
  "cms",
  "federation",
  "search_sync",
  "audit_log",
  "settings",
  "credit_management",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Labels for each module (used in settings UI) */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  products: "Products",
  orders: "Orders",
  purchasing: "Purchasing",
  inventory: "Inventory",
  suppliers: "Suppliers",
  shipping: "Shipping",
  customs: "Customs",
  approvals: "Approvals",
  reorder_suggestions: "Reorder Suggestions",
  inventory_reports: "Inventory Reports",
  reports: "Reports",
  finance: "Finance",
  customers: "Customers",
  cms: "CMS",
  federation: "Federation",
  search_sync: "Search Sync",
  audit_log: "Audit Log",
  settings: "Settings",
  credit_management: "Credit Management",
};
