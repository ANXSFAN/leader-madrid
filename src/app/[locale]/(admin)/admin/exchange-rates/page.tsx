"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  getExchangeRates,
  updateExchangeRate,
  removeExchangeRateOverride,
  refreshECBRates,
} from "@/lib/actions/exchange-rate";
import { SUPPORTED_CURRENCIES, BASE_CURRENCY, CURRENCY_INFO } from "@/lib/currency";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Pencil, RotateCcw, Check, X } from "lucide-react";

interface RateInfo {
  rate: number;
  source: string;
  date: Date | string;
  isManualOverride: boolean;
}

export default function ExchangeRatesPage() {
  const t = useTranslations("admin_exchange_rates");
  const [rates, setRates] = useState<Record<string, RateInfo>>({});
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const [isUpdating, startUpdate] = useTransition();

  const loadRates = async () => {
    const data = await getExchangeRates();
    setRates(data);
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleRefreshECB = () => {
    startRefresh(async () => {
      const result = await refreshECBRates();
      if (result.error) {
        toast.error(t("refresh_error") + ": " + result.error);
      } else {
        const updated = (result as any).updated?.length ?? 0;
        const skipped = (result as any).skipped?.length ?? 0;
        const errors = (result as any).errors ?? [];

        toast.success(
          `${t("updated", { count: updated })}, ${t("skipped", { count: skipped })}`
        );

        if (errors.length > 0) {
          for (const err of errors) {
            toast.warning(err);
          }
        }

        await loadRates();
      }
    });
  };

  const handleEdit = (currency: string, currentRate: number) => {
    setEditingCurrency(currency);
    setEditValue(currentRate.toString());
  };

  const handleSave = (currency: string) => {
    const rate = parseFloat(editValue);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Invalid rate");
      return;
    }

    startUpdate(async () => {
      const result = await updateExchangeRate(currency, rate);
      if (result.error) {
        toast.error(t("update_error") + ": " + result.error);
      } else {
        toast.success(t("update_success"));
        setEditingCurrency(null);
        await loadRates();
      }
    });
  };

  const handleResetToECB = (currency: string) => {
    startUpdate(async () => {
      const result = await removeExchangeRateOverride(currency);
      if (result.error) {
        toast.error(t("reset_error") + ": " + result.error);
      } else {
        toast.success(t("reset_success"));
        await loadRates();
      }
    });
  };

  const currencies = SUPPORTED_CURRENCIES.filter((c) => c !== BASE_CURRENCY);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={handleRefreshECB} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? t("refreshing") : t("refresh_ecb")}
          </Button>
        }
      />

      {Object.keys(rates).length <= 1 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t("no_rates")}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase tracking-widest text-xs">{t("currency")}</TableHead>
                <TableHead className="uppercase tracking-widest text-xs">{t("rate")}</TableHead>
                <TableHead className="uppercase tracking-widest text-xs">{t("source")}</TableHead>
                <TableHead className="uppercase tracking-widest text-xs">{t("last_updated")}</TableHead>
                <TableHead className="uppercase tracking-widest text-xs text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* EUR base row */}
              <TableRow>
                <TableCell className="font-medium">
                  <span className="mr-2">{CURRENCY_INFO.EUR.symbol}</span>
                  EUR — {t("base")}
                </TableCell>
                <TableCell>1.000000</TableCell>
                <TableCell>
                  <Badge variant="outline">{t("base")}</Badge>
                </TableCell>
                <TableCell>—</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>

              {currencies.map((currency) => {
                const info = rates[currency];
                const currencyInfo = CURRENCY_INFO[currency];

                return (
                  <TableRow key={currency} className="hover:bg-yellow-50/50">
                    <TableCell className="font-medium">
                      <span className="mr-2">{currencyInfo.symbol}</span>
                      {currency}
                    </TableCell>
                    <TableCell>
                      {editingCurrency === currency ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.000001"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-32 h-8"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSave(currency)}
                            disabled={isUpdating}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingCurrency(null)}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <span>{info?.rate?.toFixed(6) || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {info?.isManualOverride ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          {t("manual")}
                        </Badge>
                      ) : info?.source === "ECB" ? (
                        <Badge variant="outline">{t("ecb")}</Badge>
                      ) : (
                        <Badge variant="secondary">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {info?.date
                        ? new Date(info.date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(currency, info?.rate || 1)}
                          disabled={editingCurrency === currency}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {t("edit_rate")}
                        </Button>
                        {info?.isManualOverride && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetToECB(currency)}
                            disabled={isUpdating}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {t("reset_to_ecb")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
