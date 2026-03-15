"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { Edit } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bulkAssignPriceList } from "@/lib/actions/user";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CustomerTagBadge } from "@/components/admin/customer-tag-badge";

interface PriceList {
  id: string;
  name: string;
}

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  customerLevel: string | null;
  b2bStatus: string;
  priceLists: PriceList[];
  customerTags?: TagData[];
}

interface CustomersTableProps {
  customers: Customer[];
  priceLists: PriceList[];
}

const B2B_STATUS_VARIANT: Record<string, "status-active" | "status-pending" | "status-inactive" | "status-cancelled"> = {
  APPROVED: "status-active",
  PENDING: "status-pending",
  NOT_APPLIED: "status-inactive",
  REJECTED: "status-cancelled",
};

export function CustomersTable({ customers, priceLists }: CustomersTableProps) {
  const t = useTranslations("admin.users");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPriceList, setSelectedPriceList] = useState<string>("__none__");
  const [isPending, startTransition] = useTransition();

  const allIds = customers.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = () => {
    const ids = Array.from(selectedIds);
    const priceListId = selectedPriceList === "__none__" ? null : selectedPriceList;
    startTransition(async () => {
      const result = await bulkAssignPriceList(ids, priceListId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const name = priceLists.find((p) => p.id === priceListId)?.name ?? "";
        toast.success(
          priceListId
            ? t("bulk.assigned_count", { count: result.count, name })
            : t("bulk.cleared_count", { count: result.count })
        );
        clearSelection();
      }
    });
  };

  return (
    <div className="space-y-2">
      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 text-white rounded-lg">
          <span className="text-sm font-medium">{t("bulk.selected", { count: selectedIds.size })}</span>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={selectedPriceList} onValueChange={setSelectedPriceList}>
              <SelectTrigger className="h-7 w-44 text-xs bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder={t("bulk.select_price_list")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">
                  {t("bulk.clear_price_list")}
                </SelectItem>
                {priceLists.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id} className="text-xs">
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={handleBulkAssign}
              disabled={isPending}
            >
              {t("bulk.assign")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
                aria-label={t("bulk.select_all")}
              />
            </TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.name")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.email")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.company")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.level")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.b2b_status")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.tags")}</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.price_list")}</TableHead>
            <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-slate-500">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                {t("table.no_customers")}
              </TableCell>
            </TableRow>
          ) : (
            customers.map((user) => {
              const isSelected = selectedIds.has(user.id);
              return (
                <TableRow key={user.id} className={isSelected ? "bg-blue-50/60" : "hover:bg-yellow-50/40 transition-colors"}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(user.id)}
                      aria-label={t("bulk.select_item", { name: user.name ?? user.email ?? "" })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.companyName || "N/A"}</TableCell>
                  <TableCell>{user.customerLevel || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={B2B_STATUS_VARIANT[user.b2bStatus] ?? "status-inactive"}>
                      {t(`status_options.${user.b2bStatus}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.customerTags && user.customerTags.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.customerTags.map((tag) => (
                          <CustomerTagBadge key={tag.id} name={tag.name} color={tag.color} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.priceLists.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {user.priceLists.map((pl) => (
                          <Badge key={pl.id} variant="outline">
                            {pl.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/customers/${user.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
