"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateCreditSettings } from "@/lib/actions/credit";
import { useTranslations } from "next-intl";

interface CustomerCreditPanelProps {
  userId: string;
  creditLimit: number | null;
  paymentTermsDays: number;
  currentBalance: number;
}

export function CustomerCreditPanel({
  userId,
  creditLimit: initialCreditLimit,
  paymentTermsDays: initialPaymentTermsDays,
  currentBalance,
}: CustomerCreditPanelProps) {
  const t = useTranslations("admin.credit");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creditLimit, setCreditLimit] = useState<number | null>(initialCreditLimit);
  const [paymentTermsDays, setPaymentTermsDays] = useState(initialPaymentTermsDays);

  const available =
    creditLimit !== null ? creditLimit - currentBalance : null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCreditSettings(userId, {
        creditLimit,
        paymentTermsDays,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
        setEditing(false);
      }
    } catch {
      toast.error(t("save_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCreditLimit(initialCreditLimit);
    setPaymentTermsDays(initialPaymentTermsDays);
    setEditing(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(value);

  return (
    <Card>
      <CardHeader className="border-b border-accent">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("edit")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("credit_limit")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={creditLimit ?? ""}
                    placeholder={t("no_limit")}
                    onChange={(e) =>
                      setCreditLimit(
                        e.target.value === "" ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("no_limit_hint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("payment_terms")}</Label>
                <Select
                  value={String(paymentTermsDays)}
                  onValueChange={(v) => setPaymentTermsDays(parseInt(v, 10))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t("prepay")}</SelectItem>
                    <SelectItem value="30">{t("net_30")}</SelectItem>
                    <SelectItem value="60">{t("net_60")}</SelectItem>
                    <SelectItem value="90">{t("net_90")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {saving ? t("saving") : t("save")}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("credit_limit")}</p>
              <p className="text-lg font-semibold">
                {creditLimit !== null ? formatCurrency(creditLimit) : t("no_limit")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("payment_terms")}</p>
              <p className="text-lg font-semibold">
                {paymentTermsDays === 0
                  ? t("prepay")
                  : paymentTermsDays === 30
                    ? t("net_30")
                    : paymentTermsDays === 60
                      ? t("net_60")
                      : paymentTermsDays === 90
                        ? t("net_90")
                        : `Net ${paymentTermsDays}`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("current_balance")}
              </p>
              <p className="text-lg font-semibold">
                {formatCurrency(currentBalance)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t("available_credit")}
              </p>
              <p className="text-lg font-semibold">
                {available !== null ? formatCurrency(available) : t("no_limit")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
