"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateCustomerPriceList } from "@/lib/actions/price-list";
import { PriceListRulesTable } from "./price-list-rules-table";
import { useTranslations } from "next-intl";

interface PriceListData {
  id: string;
  name: string;
  currency: string;
  discountPercent: number | { toNumber(): number } | null;
  rules: any[];
}

interface CustomerPricingPanelProps {
  userId: string;
  userName: string;
  priceList: PriceListData | null;
}

export function CustomerPricingPanel({
  userId,
  userName,
  priceList: initialPriceList,
}: CustomerPricingPanelProps) {
  const [priceList, setPriceList] = useState<PriceListData | null>(initialPriceList);
  const [creating, setCreating] = useState(false);
  const t = useTranslations("admin.users.pricing_panel");

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await getOrCreateCustomerPriceList(userId, userName);
      if (res.error) {
        toast.error(res.error);
      } else if (res.priceList) {
        setPriceList(res.priceList as any);
        toast.success(t("created_success"));
      }
    } catch {
      toast.error(t("created_error"));
    } finally {
      setCreating(false);
    }
  };

  const discountValue = priceList?.discountPercent
    ? typeof priceList.discountPercent === "object" && "toNumber" in priceList.discountPercent
      ? priceList.discountPercent.toNumber()
      : Number(priceList.discountPercent)
    : 0;

  return (
    <Card>
      <CardHeader className="border-b border-accent">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {!priceList ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">{t("create_description")}</p>
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {t("create_price_list")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("price_list_info")}:</span>{" "}
                <span className="font-medium">{priceList.name}</span>
              </div>
              <Badge variant="outline">{priceList.currency}</Badge>
              {discountValue > 0 && (
                <div>
                  <span className="text-muted-foreground">{t("discount_percent")}:</span>{" "}
                  <span className="font-medium">{discountValue}%</span>
                </div>
              )}
            </div>
            <PriceListRulesTable
              priceListId={priceList.id}
              rules={priceList.rules}
              currency={priceList.currency}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
