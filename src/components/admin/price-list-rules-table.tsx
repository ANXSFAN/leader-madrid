"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePriceListRule } from "@/lib/actions/price-list";
import { AddRuleDialog } from "./add-rule-dialog";
import { Decimal } from "@prisma/client/runtime/library";
import { useTranslations } from "next-intl";

interface Rule {
  id: string;
  variant: {
    sku: string;
    product: {
      slug: string;
      content: any;
    };
  };
  minQuantity: number;
  price: Decimal | number | string;
}

interface PriceListRulesTableProps {
  priceListId: string;
  rules: Rule[];
  currency: string;
}

export function PriceListRulesTable({
  priceListId,
  rules,
  currency,
}: PriceListRulesTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const t = useTranslations("admin.priceLists.rules");

  const handleDelete = async (id: string) => {
    try {
      setLoading(id);
      const res = await deletePriceListRule(id, priceListId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("toast_deleted"));
      }
    } catch (error) {
      toast.error(t("toast_delete_error"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <AddRuleDialog priceListId={priceListId} />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sku")}</TableHead>
              <TableHead>{t("product_name")}</TableHead>
              <TableHead>{t("min_quantity")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  {rule.variant.sku}
                </TableCell>
                <TableCell>
                  {(rule.variant.product.content as any)?.en?.name ||
                    (rule.variant.product.content as any)?.es?.name ||
                    rule.variant.product.slug}
                </TableCell>
                <TableCell>{rule.minQuantity}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: currency,
                  }).format(Number(rule.price))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                    disabled={loading === rule.id}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
