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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  InventoryTransaction,
  InventoryType,
  ProductVariant,
  Product,
} from "@prisma/client";
import { getLocalized } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Package, Filter, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";

type TransactionWithRelations = InventoryTransaction & {
  variant: ProductVariant & {
    product: Product;
  };
  warehouse?: { name: string } | null;
};

interface InventoryHistoryTableProps {
  transactions: TransactionWithRelations[];
}

/**
 * Build a link to the source document based on transaction type and reference.
 */
function getSourceLink(type: InventoryType, reference: string | null): string | null {
  if (!reference) return null;
  switch (type) {
    case "PURCHASE_ORDER":
      if (reference.startsWith("QSI-")) {
        return `/admin/purchase-stock-in`;
      }
      return `/admin/purchase-orders`;
    case "SALE_ORDER":
      return `/admin/sales-orders`;
    case "RETURN":
      return `/admin/returns`;
    default:
      return null;
  }
}

const getTypeColor = (type: InventoryType) => {
  switch (type) {
    case "PURCHASE_ORDER":
    case "RETURN":
      return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200";
    case "SALE_ORDER":
    case "DAMAGED":
      return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200";
    case "ADJUSTMENT":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200";
    default:
      return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
};

const getTypeLabel = (type: InventoryType): string => {
  switch (type) {
    case "PURCHASE_ORDER": return "purchase_order";
    case "SALE_ORDER": return "sale_order";
    case "ADJUSTMENT": return "adjustment";
    case "RETURN": return "return";
    case "DAMAGED": return "damaged";
    default: return type;
  }
};

export function InventoryHistoryTable({
  transactions,
}: InventoryHistoryTableProps) {
  const locale = useLocale();
  const t = useTranslations("admin.inventory.history");
  const tType = useTranslations("admin.inventory.type");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="w-[180px]">{t("col_time")}</TableHead>
            <TableHead>{t("col_product")}</TableHead>
            <TableHead>{t("col_type")}</TableHead>
            <TableHead>{t("col_quantity")}</TableHead>
            <TableHead>{t("col_note")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const productContent = getLocalized(tx.variant.product.content, locale);
            const isPositive = tx.quantity > 0;
            const isBundleComponent = tx.note?.includes("Bundle Component");
            const isExpanded = expandedIds.has(tx.id);
            const sourceLink = getSourceLink(tx.type, tx.reference);

            return (
              <>
                <TableRow
                  key={tx.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleExpand(tx.id)}
                >
                  <TableCell className="px-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{productContent.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {tx.variant.sku}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant="outline" className={getTypeColor(tx.type)}>
                        {tType(tx.type as any)}
                      </Badge>
                      {isBundleComponent && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 px-1.5 bg-purple-100 text-purple-700 border-purple-200"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          {t("bundle_component")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-bold font-mono",
                        isPositive ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {tx.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    {tx.reference && (
                      <span className="text-sm font-medium">
                        {t("ref_prefix")} {tx.reference}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${tx.id}-detail`} className="bg-slate-50/70">
                    <TableCell colSpan={6} className="py-4 px-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">
                            {t("col_product")}
                          </span>
                          <span className="font-medium">{productContent.name}</span>
                          <span className="text-xs text-slate-500 font-mono block">
                            {tx.variant.sku}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">
                            {t("col_type")}
                          </span>
                          <Badge variant="outline" className={getTypeColor(tx.type)}>
                            {tType(tx.type as any)}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">
                            {t("col_quantity")}
                          </span>
                          <span
                            className={cn(
                              "font-bold font-mono text-base",
                              isPositive ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {isPositive ? "+" : ""}
                            {tx.quantity}
                          </span>
                        </div>
                        {tx.warehouse && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">
                              {t("col_warehouse") || "Warehouse"}
                            </span>
                            <span className="font-medium">{tx.warehouse.name}</span>
                          </div>
                        )}
                        {tx.reference && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">
                              {t("ref_prefix")}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">{tx.reference}</span>
                              {sourceLink && (
                                <Link
                                  href={sourceLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-slate-400 hover:text-slate-600"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              )}
                              <Link
                                href={`/admin/inventory?q=${encodeURIComponent(tx.reference)}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-slate-400 hover:text-slate-600"
                                  title={t("filter_by_ref") || "Filter by reference"}
                                >
                                  <Filter className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        )}
                        {tx.note && (
                          <div className="col-span-2 md:col-span-4">
                            <span className="text-muted-foreground block text-xs mb-1">
                              {t("col_note")}
                            </span>
                            <span className="text-slate-700">
                              {tx.note.replace("(Bundle Component)", "").trim()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">
                            {t("col_time")}
                          </span>
                          <span>{format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>
                        </div>
                        {tx.createdBy && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">
                              {t("col_operator") || "Operator"}
                            </span>
                            <span className="font-mono text-xs">{tx.createdBy}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-slate-500"
              >
                {t("no_records")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
