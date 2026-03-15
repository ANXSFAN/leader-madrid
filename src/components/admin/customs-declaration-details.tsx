"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Edit, Trash2, Ship, Plane, Truck, Train } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomsStatusBadge } from "@/components/admin/customs-status-badge";
import {
  updateCustomsStatus,
  deleteCustomsDeclaration,
} from "@/lib/actions/customs";
import { formatMoney } from "@/lib/formatters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Declaration = any;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["INSPECTING", "CLEARED", "HELD"],
  INSPECTING: ["CLEARED", "HELD"],
  HELD: ["RELEASED"],
};

const SHIPPING_ICONS: Record<string, React.ReactNode> = {
  SEA: <Ship className="h-4 w-4" />,
  AIR: <Plane className="h-4 w-4" />,
  ROAD: <Truck className="h-4 w-4" />,
  RAIL: <Train className="h-4 w-4" />,
};

interface CustomsDeclarationDetailsProps {
  declaration: Declaration;
}

export function CustomsDeclarationDetails({
  declaration,
}: CustomsDeclarationDetailsProps) {
  const t = useTranslations("admin.customs");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const currency = declaration.currency || "EUR";

  const nextStatuses = STATUS_TRANSITIONS[declaration.status] || [];

  async function handleStatusChange(
    newStatus: "DRAFT" | "SUBMITTED" | "INSPECTING" | "CLEARED" | "HELD" | "RELEASED"
  ) {
    setLoading(true);
    try {
      const result = await updateCustomsStatus(declaration.id, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toast.status_updated"));
        router.refresh();
      }
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("detail.confirm_delete"))) return;
    setLoading(true);
    try {
      const result = await deleteCustomsDeclaration(declaration.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("toast.deleted"));
        router.push("/admin/customs");
      }
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/customs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("detail.back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {t("title")}: {declaration.declarationNumber}
          </h1>
          <CustomsStatusBadge
            status={declaration.status}
            label={t(`status.${declaration.status}`)}
          />
        </div>
        <div className="flex items-center gap-2">
          {declaration.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/customs/${declaration.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("detail.edit")}
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("detail.delete")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Change Buttons */}
      {nextStatuses.length > 0 && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t("detail.status_actions")}
          </h3>
          <div className="flex gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() =>
                  handleStatusChange(
                    status as "DRAFT" | "SUBMITTED" | "INSPECTING" | "CLEARED" | "HELD" | "RELEASED"
                  )
                }
              >
                {t(`status.${status}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Declaration Info */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t("detail.customs_info")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoField
            label={t("table.declaration_number")}
            value={declaration.declarationNumber}
          />
          <InfoField
            label={t("form.type")}
            value={
              <Badge variant={declaration.type === "IMPORT" ? "secondary" : "outline"}>
                {t(`type.${declaration.type}`)}
              </Badge>
            }
          />
          <InfoField
            label={t("form.customs_office")}
            value={declaration.customsOffice}
          />
          <InfoField
            label={t("form.entry_port")}
            value={declaration.entryPort}
          />
          <InfoField
            label={t("form.country_of_origin")}
            value={declaration.countryOfOrigin}
          />
          <InfoField
            label={t("form.destination_country")}
            value={declaration.destinationCountry}
          />
          {declaration.purchaseOrder && (
            <InfoField
              label={t("form.purchase_order")}
              value={declaration.purchaseOrder.poNumber}
            />
          )}
          {declaration.salesOrder && (
            <InfoField
              label={t("form.sales_order")}
              value={declaration.salesOrder.orderNumber}
            />
          )}
          <InfoField
            label={t("form.notes")}
            value={declaration.notes}
          />
        </div>
      </div>

      {/* Financial Summary */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t("detail.financial_info")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoField
            label={t("form.declared_value")}
            value={formatMoney(declaration.declaredValue || 0, { locale, currency })}
          />
          <InfoField
            label={"Currency"}
            value={declaration.currency}
          />
          <InfoField
            label={t("form.duty_rate")}
            value={
              declaration.dutyRate != null
                ? `${declaration.dutyRate}%`
                : undefined
            }
          />
          <InfoField
            label={t("form.duty_amount")}
            value={
              declaration.dutyAmount != null
                ? formatMoney(declaration.dutyAmount, { locale, currency })
                : undefined
            }
          />
          <InfoField
            label={t("form.vat_amount")}
            value={
              declaration.vatAmount != null
                ? formatMoney(declaration.vatAmount, { locale, currency })
                : undefined
            }
          />
          <InfoField
            label={t("form.other_charges")}
            value={
              declaration.otherCharges != null
                ? formatMoney(declaration.otherCharges, { locale, currency })
                : undefined
            }
          />
          <InfoField
            label={t("form.total_cost")}
            value={
              declaration.totalCost != null
                ? formatMoney(declaration.totalCost, { locale, currency })
                : undefined
            }
          />
        </div>
      </div>

      {/* Logistics */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t("detail.logistics_info")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoField
            label={t("form.tracking_number")}
            value={declaration.trackingNumber}
          />
          <InfoField
            label={t("form.shipping_method")}
            value={
              declaration.shippingMethod ? (
                <span className="inline-flex items-center gap-2">
                  {SHIPPING_ICONS[declaration.shippingMethod]}
                  {t(`shipping_method.${declaration.shippingMethod}`)}
                </span>
              ) : undefined
            }
          />
          <InfoField
            label={t("form.estimated_arrival")}
            value={
              declaration.estimatedArrival
                ? format(new Date(declaration.estimatedArrival), "yyyy-MM-dd")
                : undefined
            }
          />
        </div>
      </div>

      {/* Broker */}
      {(declaration.brokerName || declaration.brokerContact) && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t("detail.broker_info")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField
              label={t("form.broker_name")}
              value={declaration.brokerName}
            />
            <InfoField
              label={t("form.broker_contact")}
              value={declaration.brokerContact}
            />
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t("detail.items_title")}
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("form.item_product_name")}</TableHead>
                <TableHead>{t("form.item_sku")}</TableHead>
                <TableHead>{t("form.item_hs_code")}</TableHead>
                <TableHead className="text-right">{t("form.item_quantity")}</TableHead>
                <TableHead className="text-right">{t("form.item_unit_price")}</TableHead>
                <TableHead className="text-right">{t("form.item_total_value")}</TableHead>
                <TableHead className="text-right">{t("form.item_weight")}</TableHead>
                <TableHead>{t("form.item_origin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {declaration.items?.map(
                (
                  item: {
                    id: string;
                    productName: string;
                    sku?: string | null;
                    hsCode?: string | null;
                    quantity: number;
                    unitPrice: number;
                    totalValue: number;
                    weight?: number | null;
                    countryOfOrigin?: string | null;
                  },
                  idx: number
                ) => (
                  <TableRow key={item.id || idx}>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell>{item.sku || "—"}</TableCell>
                    <TableCell>{item.hsCode || "—"}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(item.unitPrice, { locale, currency })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(item.totalValue, { locale, currency })}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.weight != null ? `${item.weight} kg` : "—"}
                    </TableCell>
                    <TableCell>{item.countryOfOrigin || "—"}</TableCell>
                  </TableRow>
                )
              )}
              {(!declaration.items || declaration.items.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center h-16 text-muted-foreground"
                  >
                    No items.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">
Timeline
        </h3>
        <div className="space-y-3">
          <TimelineEntry
            label="Created"
            date={declaration.createdAt}
          />
          <TimelineEntry
            label="Updated"
            date={declaration.updatedAt}
          />
          <TimelineEntry
            label={t("detail.submit")}
            date={declaration.submittedAt}
          />
          <TimelineEntry
            label={t("detail.mark_cleared")}
            date={declaration.clearedAt}
          />
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function TimelineEntry({
  label,
  date,
}: {
  label: string;
  date?: string | Date | null;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">
        {date
          ? format(new Date(date), "yyyy-MM-dd HH:mm")
          : <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}
