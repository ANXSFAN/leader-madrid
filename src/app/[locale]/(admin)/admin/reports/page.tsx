import { getTranslations } from "next-intl/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport } from "./sales-report";
import { InventoryReport } from "./inventory-report";
import { CustomerReport } from "./customer-report";
import { OrdersReport } from "./orders-report";
import { PriceTrendsReport } from "./price-trends-report";
import { MarginReport } from "./margin-report";
import { ProcurementReport } from "./procurement-report";
import { ARReport } from "./ar-report";
import { PageHeader } from "@/components/admin/page-header";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { parseDateRange } from "@/lib/report-utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.reports");
  const dateRange = parseDateRange(searchParams);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <DateRangePicker />

      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 max-w-5xl">
          <TabsTrigger value="sales">{t("tabs.sales")}</TabsTrigger>
          <TabsTrigger value="orders">{t("tabs.orders")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("tabs.inventory")}</TabsTrigger>
          <TabsTrigger value="customers">{t("tabs.customers")}</TabsTrigger>
          <TabsTrigger value="margins">{t("tabs.margins")}</TabsTrigger>
          <TabsTrigger value="procurement">{t("tabs.procurement")}</TabsTrigger>
          <TabsTrigger value="receivables">{t("tabs.receivables")}</TabsTrigger>
          <TabsTrigger value="price-trends">{t("tabs.priceTrends")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-6">
          <SalesReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrdersReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <InventoryReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <CustomerReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="margins" className="mt-6">
          <MarginReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="procurement" className="mt-6">
          <ProcurementReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="receivables" className="mt-6">
          <ARReport dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="price-trends" className="mt-6">
          <PriceTrendsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
