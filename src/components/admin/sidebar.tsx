"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Warehouse,
  Banknote,
  Truck,
  ClipboardList,
  FileText,
  ListTree,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Image,
  Send,
  RotateCcw,
  BarChart2,
  SearchCheck,
  FilePlus,
  Menu as MenuIcon,
  Mail,
  ArrowLeftRight,
  Shield,
  PackageCheck,
  ClipboardCheck,
  Undo2,
  MapPin,
  Layers,
  CheckCircle,
  AlertTriangle,
  PieChart,
  Network,
  ScrollText,
  Tags,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { type ModuleKey } from "@/lib/modules";

/** All sidebar translation keys used in admin.sidebar namespace */
type SidebarKey =
  | "dashboard" | "products" | "all_products" | "categories" | "attributes"
  | "orders" | "web_orders" | "sales_orders" | "delivery_orders" | "returns" | "quote_requests"
  | "purchasing" | "purchase_orders" | "purchase_stock_in" | "purchase_returns"
  | "inventory" | "inventory_log" | "warehouses" | "stock_adjustments" | "stock_transfers"
  | "stock_takes" | "inventory_lots" | "bin_locations"
  | "suppliers" | "shipping" | "customs" | "reports"
  | "finance" | "sales_invoices" | "vat_config" | "exchange_rates"
  | "customers" | "all_customers" | "price_lists" | "customer_tags"
  | "cms" | "banners" | "pages" | "mega_menus" | "contact_submissions" | "site_info"
  | "federation"
  | "search_sync" | "settings" | "audit_log" | "approvals" | "reorder_suggestions" | "inventory_reports";

type SidebarItem = {
  key: SidebarKey;
  href: string;
  icon: React.ElementType;
  module?: ModuleKey;
  submenu?: { key: SidebarKey; href: string; icon: React.ElementType }[];
};

const sidebarItems: SidebarItem[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard, module: "dashboard" },
  {
    key: "products",
    href: "/admin/products",
    icon: Package,
    module: "products",
    submenu: [
      { key: "all_products", href: "/admin/products", icon: Package },
      { key: "categories", href: "/admin/categories", icon: FolderTree },
      { key: "attributes", href: "/admin/attributes", icon: ListTree },
    ],
  },
  {
    key: "orders",
    href: "/admin/orders-group",
    icon: ShoppingCart,
    module: "orders",
    submenu: [
      { key: "web_orders", href: "/admin/orders", icon: ShoppingCart },
      { key: "sales_orders", href: "/admin/sales-orders", icon: FileText },
      { key: "delivery_orders", href: "/admin/delivery-orders", icon: PackageCheck },
      { key: "returns", href: "/admin/returns", icon: RotateCcw },
      { key: "quote_requests", href: "/admin/rfq", icon: FilePlus },
    ],
  },
  {
    key: "purchasing",
    href: "/admin/purchasing-group",
    icon: ClipboardList,
    module: "purchasing",
    submenu: [
      { key: "purchase_orders", href: "/admin/purchase-orders", icon: ClipboardList },
      { key: "purchase_stock_in", href: "/admin/purchase-stock-in", icon: FilePlus },
      { key: "purchase_returns", href: "/admin/purchase-returns", icon: Undo2 },
    ],
  },
  {
    key: "inventory",
    href: "/admin/inventory-group",
    icon: Warehouse,
    module: "inventory",
    submenu: [
      { key: "inventory_log", href: "/admin/inventory", icon: Warehouse },
      { key: "warehouses", href: "/admin/warehouses", icon: Warehouse },
      { key: "stock_adjustments", href: "/admin/stock-adjustments", icon: ClipboardList },
      { key: "stock_transfers", href: "/admin/stock-transfers", icon: ArrowLeftRight },
      { key: "stock_takes", href: "/admin/stock-takes", icon: ClipboardCheck },
      { key: "inventory_lots", href: "/admin/inventory-lots", icon: Layers },
      { key: "bin_locations", href: "/admin/bin-locations", icon: MapPin },
    ],
  },
  { key: "suppliers", href: "/admin/suppliers", icon: Truck, module: "suppliers" },
  { key: "shipping", href: "/admin/shipping", icon: Send, module: "shipping" },
  { key: "customs", href: "/admin/customs", icon: Shield, module: "customs" },
  { key: "approvals", href: "/admin/approvals", icon: CheckCircle, module: "approvals" },
  { key: "reorder_suggestions", href: "/admin/reorder-suggestions", icon: AlertTriangle, module: "reorder_suggestions" },
  { key: "inventory_reports", href: "/admin/inventory-reports", icon: PieChart, module: "inventory_reports" },
  { key: "reports", href: "/admin/reports", icon: BarChart2, module: "reports" },
  {
    key: "finance",
    href: "/admin/finance",
    icon: Banknote,
    module: "finance",
    submenu: [
      { key: "sales_invoices", href: "/admin/invoices", icon: FileText },
      { key: "vat_config", href: "/admin/vat", icon: FileText },
      { key: "exchange_rates", href: "/admin/exchange-rates", icon: ArrowLeftRight },
    ],
  },
  {
    key: "customers",
    href: "/admin/customers",
    icon: Users,
    module: "customers",
    submenu: [
      { key: "all_customers", href: "/admin/customers", icon: Users },
      { key: "customer_tags", href: "/admin/customer-tags", icon: Tags },
      { key: "price_lists", href: "/admin/price-lists", icon: FileText },
    ],
  },
  {
    key: "cms",
    href: "/admin/cms",
    icon: Image,
    module: "cms",
    submenu: [
      { key: "banners", href: "/admin/cms/banners", icon: Image },
      { key: "pages", href: "/admin/cms/pages", icon: FileText },
      { key: "mega_menus", href: "/admin/cms/mega-menus", icon: MenuIcon },
      { key: "contact_submissions", href: "/admin/cms/contact-submissions", icon: Mail },
      { key: "site_info", href: "/admin/cms/site-info", icon: Settings },
    ],
  },
  { key: "federation", href: "/admin/federation", icon: Network, module: "federation" },
  { key: "search_sync", href: "/admin/search-sync", icon: SearchCheck, module: "search_sync" },
  { key: "audit_log", href: "/admin/audit-log", icon: ScrollText, module: "settings" },
  { key: "settings", href: "/admin/settings", icon: Settings, module: "settings" },
];

interface AdminSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  enabledModules?: Record<string, boolean>;
}

export function AdminSidebar({ mobile = false, onNavigate, enabledModules }: AdminSidebarProps = {}) {
  const t = useTranslations("admin.sidebar");
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const visibleItems = useMemo(
    () =>
      enabledModules
        ? sidebarItems.filter((item) => !item.module || enabledModules[item.module] !== false)
        : sidebarItems,
    [enabledModules]
  );

  useEffect(() => {
    const newExpanded: Record<string, boolean> = {};
    visibleItems.forEach((item) => {
      if (item.submenu) {
        const isSubmenuActive = item.submenu.some((sub) =>
          pathname.startsWith(sub.href)
        );
        if (isSubmenuActive) newExpanded[item.key] = true;
      }
    });
    setExpandedItems((prev) => ({ ...prev, ...newExpanded }));
  }, [pathname]);

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={mobile ? "bg-slate-900 text-slate-300 w-full min-h-screen" : "hidden border-r bg-slate-900 text-slate-300 md:block w-64 min-h-screen"}>
      <div className="flex h-16 items-center border-b border-slate-800 px-5">
        <Link
          href="/admin"
          className="flex items-center gap-3"
        >
          <div className="h-9 w-9 rounded-lg bg-[#004e92] shadow-lg shadow-blue-900/30 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo-icon.svg" alt="ZELURA" className="h-9 w-9" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-none">ZELURA</span>
            <span className="text-slate-500 text-[10px] tracking-widest uppercase mt-0.5">Admin Panel</span>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-3 text-sm font-medium">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isSubmenuActive = item.submenu?.some((sub) =>
              pathname.startsWith(sub.href)
            );
            const isActive = pathname === item.href || isSubmenuActive;
            const isExpanded = expandedItems[item.key];

            if (item.submenu) {
              return (
                <div key={item.key} className="mb-0.5">
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all text-slate-400 select-none cursor-pointer hover:bg-slate-800/60 hover:text-slate-200",
                      isActive && "text-slate-200"
                    )}
                    onClick={() => toggleExpand(item.key)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t(item.key)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="pl-4 mt-0.5 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                      {item.submenu.map((sub) => {
                        const SubIcon = sub.icon;
                        const isItemActive =
                          sub.href === "/admin/products"
                            ? (pathname === "/admin/products" ||
                                pathname.startsWith("/admin/products/")) &&
                              !pathname.startsWith("/admin/categories") &&
                              !pathname.startsWith("/admin/attributes")
                            : pathname.startsWith(sub.href);

                        return (
                          <Link
                            key={sub.key}
                            href={sub.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                              isItemActive
                                ? "bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500"
                                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                            )}
                          >
                            <SubIcon className="h-4 w-4 shrink-0" />
                            {t(sub.key)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all mb-0.5",
                  isActive
                    ? "bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
