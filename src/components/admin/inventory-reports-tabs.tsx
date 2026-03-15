"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/admin/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/formatters";
import { Loader2, DollarSign, ArrowLeftRight, BarChart3, Archive, Users } from "lucide-react";
import {
  getInventoryValueReport,
  getStockMovementSummary,
  getInventoryTurnoverReport,
  getDeadStockReport,
  getSupplierPerformanceReport,
} from "@/lib/actions/inventory-reports";
import type {
  InventoryValueReport,
  StockMovementSummary,
  TurnoverItem,
  DeadStockItem,
  SupplierPerformanceItem,
} from "@/lib/actions/inventory-reports";
import { format } from "date-fns";

interface Props {
  locale: string;
  currency: string;
}

export function InventoryReportsTabs({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");

  return (
    <Tabs defaultValue="value" className="space-y-4">
      <TabsList>
        <TabsTrigger value="value">{t("tabs.value")}</TabsTrigger>
        <TabsTrigger value="movement">{t("tabs.movement")}</TabsTrigger>
        <TabsTrigger value="turnover">{t("tabs.turnover")}</TabsTrigger>
        <TabsTrigger value="dead_stock">{t("tabs.dead_stock")}</TabsTrigger>
        <TabsTrigger value="supplier">{t("tabs.supplier")}</TabsTrigger>
      </TabsList>

      <TabsContent value="value">
        <InventoryValueTab locale={locale} currency={currency} />
      </TabsContent>
      <TabsContent value="movement">
        <StockMovementTab locale={locale} currency={currency} />
      </TabsContent>
      <TabsContent value="turnover">
        <TurnoverTab locale={locale} currency={currency} />
      </TabsContent>
      <TabsContent value="dead_stock">
        <DeadStockTab locale={locale} currency={currency} />
      </TabsContent>
      <TabsContent value="supplier">
        <SupplierTab locale={locale} currency={currency} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Tab 1: Inventory Value ──────────────────────────────────────────────────

function InventoryValueTab({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");
  const [data, setData] = useState<InventoryValueReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getInventoryValueReport();
      if ("error" in result) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <StatCard
        title={t("value.grand_total")}
        value={formatMoney(data.totalValue, { locale, currency })}
        icon={DollarSign}
        color="green"
      />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("value.sku")}</TableHead>
              <TableHead>{t("value.product")}</TableHead>
              <TableHead className="text-right">{t("value.stock")}</TableHead>
              <TableHead className="text-right">{t("value.cost_price")}</TableHead>
              <TableHead className="text-right">{t("value.total_value")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right">{item.stock}</TableCell>
                <TableCell className="text-right">{formatMoney(item.costPrice, { locale, currency })}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(item.totalValue, { locale, currency })}</TableCell>
              </TableRow>
            ))}
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  {t("no_data")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tab 2: Stock Movement ───────────────────────────────────────────────────

function StockMovementTab({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");
  const [data, setData] = useState<StockMovementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Default: last 30 days
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);

    startTransition(async () => {
      const result = await getStockMovementSummary(
        dateFrom.toISOString(),
        dateTo.toISOString()
      );
      if ("error" in result) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <StatCard title={t("movement.total_in")} value={data.totalIn} icon={ArrowLeftRight} color="green" />
        <StatCard title={t("movement.total_out")} value={data.totalOut} icon={ArrowLeftRight} color="red" />
        <StatCard
          title={t("movement.net")}
          value={data.totalIn - data.totalOut}
          icon={ArrowLeftRight}
          color={data.totalIn - data.totalOut >= 0 ? "blue" : "red"}
        />
      </div>

      <div className="rounded-md border bg-white">
        <div className="p-3 border-b font-semibold text-sm text-slate-600">
          {t("movement.by_type")}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("movement.type")}</TableHead>
              <TableHead className="text-right">{t("movement.in")}</TableHead>
              <TableHead className="text-right">{t("movement.out")}</TableHead>
              <TableHead className="text-right">{t("movement.count")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byType.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="font-medium">{row.type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right text-green-600">+{row.totalIn}</TableCell>
                <TableCell className="text-right text-red-600">-{row.totalOut}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.topMovedItems.length > 0 && (
        <div className="rounded-md border bg-white">
          <div className="p-3 border-b font-semibold text-sm text-slate-600">
            {t("movement.top_moved")}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("value.sku")}</TableHead>
                <TableHead>{t("value.product")}</TableHead>
                <TableHead className="text-right">{t("movement.in")}</TableHead>
                <TableHead className="text-right">{t("movement.out")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topMovedItems.map((item) => (
                <TableRow key={item.variantId}>
                  <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-right text-green-600">+{item.totalIn}</TableCell>
                  <TableCell className="text-right text-red-600">-{item.totalOut}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Turnover Analysis ────────────────────────────────────────────────

function TurnoverTab({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");
  const [data, setData] = useState<TurnoverItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getInventoryTurnoverReport();
      if ("error" in result) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("value.sku")}</TableHead>
              <TableHead>{t("value.product")}</TableHead>
              <TableHead className="text-right">{t("turnover.current_stock")}</TableHead>
              <TableHead className="text-right">{t("turnover.outbound_6m")}</TableHead>
              <TableHead className="text-right">{t("turnover.ratio")}</TableHead>
              <TableHead className="text-right">{t("value.cost_price")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right">{item.currentStock}</TableCell>
                <TableCell className="text-right">{item.totalOutbound}</TableCell>
                <TableCell className="text-right font-medium">
                  {item.turnoverRatio.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(item.costPrice, { locale, currency })}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {t("no_data")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tab 4: Dead Stock ───────────────────────────────────────────────────────

function DeadStockTab({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");
  const [data, setData] = useState<{ items: DeadStockItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getDeadStockReport();
      if ("error" in result) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const totalDeadValue = data.items.reduce((sum, i) => sum + i.totalValue, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <StatCard
          title={t("dead_stock.total_items")}
          value={data.items.length}
          icon={Archive}
          color="red"
        />
        <StatCard
          title={t("dead_stock.total_value")}
          value={formatMoney(totalDeadValue, { locale, currency })}
          icon={DollarSign}
          color="red"
        />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("value.sku")}</TableHead>
              <TableHead>{t("value.product")}</TableHead>
              <TableHead className="text-right">{t("value.stock")}</TableHead>
              <TableHead className="text-right">{t("value.total_value")}</TableHead>
              <TableHead>{t("dead_stock.last_movement")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right">{item.stock}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(item.totalValue, { locale, currency })}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.lastMovementDate
                    ? format(new Date(item.lastMovementDate), "yyyy-MM-dd")
                    : t("dead_stock.never")}
                </TableCell>
              </TableRow>
            ))}
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  {t("dead_stock.none")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tab 5: Supplier Performance ─────────────────────────────────────────────

function SupplierTab({ locale, currency }: Props) {
  const t = useTranslations("admin.inventoryReports");
  const [data, setData] = useState<SupplierPerformanceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getSupplierPerformanceReport();
      if ("error" in result) {
        setError(result.error);
      } else {
        setData(result);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("supplier.name")}</TableHead>
              <TableHead>{t("supplier.code")}</TableHead>
              <TableHead className="text-right">{t("supplier.total_pos")}</TableHead>
              <TableHead className="text-right">{t("supplier.received")}</TableHead>
              <TableHead className="text-right">{t("supplier.avg_lead_time")}</TableHead>
              <TableHead className="text-right">{t("supplier.total_amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.supplierId}>
                <TableCell className="font-medium">{item.supplierName}</TableCell>
                <TableCell className="font-mono text-sm">{item.supplierCode}</TableCell>
                <TableCell className="text-right">{item.totalPOs}</TableCell>
                <TableCell className="text-right">{item.totalReceived}</TableCell>
                <TableCell className="text-right">
                  {item.avgDaysToReceive !== null
                    ? `${item.avgDaysToReceive} ${t("supplier.days")}`
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(item.totalAmount, { locale, currency })}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {t("no_data")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-red-50 text-red-700 p-4 text-sm">
      {message}
    </div>
  );
}
