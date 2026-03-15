"use client";

import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormField } from "@/components/ui/form";
import { useTranslations } from "next-intl";
import type { ProductFormValues } from "./product-form-schema";

interface ProductVariantsTableProps {
  form: UseFormReturn<ProductFormValues>;
  variantFields: { id: string; sku: string; specs?: Record<string, string> }[];
  selectedVariants: number[];
  toggleSelectAll: () => void;
  toggleSelectVariant: (index: number) => void;
  batchPrice: string;
  setBatchPrice: (v: string) => void;
  batchStock: string;
  setBatchStock: (v: string) => void;
  applyBatchUpdate: () => void;
  isEditing?: boolean;
}

export function ProductVariantsTable({
  form,
  variantFields,
  selectedVariants,
  toggleSelectAll,
  toggleSelectVariant,
  batchPrice,
  setBatchPrice,
  batchStock,
  setBatchStock,
  applyBatchUpdate,
  isEditing,
}: ProductVariantsTableProps) {
  const t = useTranslations("admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("products.form.tabs.variants")} ({variantFields.length})
        </CardTitle>
        <CardDescription>
          {t("products.form.extra.variants_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 items-center">
          <Input
            placeholder={t("products.form.placeholders.batch_price")}
            className="w-24"
            value={batchPrice}
            onChange={(e) => setBatchPrice(e.target.value)}
          />
          {isEditing ? (
            <span className="text-xs text-muted-foreground italic">
              {t("products.form.extra.stock_managed_via_orders")}
            </span>
          ) : (
            <Input
              placeholder={t("products.form.placeholders.batch_stock")}
              className="w-24"
              value={batchStock}
              onChange={(e) => setBatchStock(e.target.value)}
            />
          )}
          <Button type="button" size="sm" onClick={applyBatchUpdate}>
            {t("products.form.buttons.apply_batch")}
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]">
                  <input type="checkbox" onChange={toggleSelectAll} />
                </TableHead>
                <TableHead>{t("products.form.fields.sku")}</TableHead>
                <TableHead>{t("products.form.tabs.specs")}</TableHead>
                <TableHead>{t("products.form.fields.price")}</TableHead>
                <TableHead>B2B</TableHead>
                <TableHead>
                  {t("products.form.fields.compare_at_price")}
                </TableHead>
                <TableHead>
                  <div>
                    {t("products.form.fields.stock")}
                    {isEditing && (
                      <p className="text-[10px] font-normal text-muted-foreground leading-tight mt-0.5">
                        {t("products.form.extra.stock_managed_via_orders")}
                      </p>
                    )}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variantFields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedVariants.includes(index)}
                      onChange={() => toggleSelectVariant(index)}
                    />
                  </TableCell>
                  <TableCell>{field.sku}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(
                        form.getValues(`variants.${index}.specs`) || {}
                      ).map(([k, v]) => (
                        <Badge
                          key={k}
                          variant="secondary"
                          className="text-xs"
                        >
                          {k}: {v}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`variants.${index}.price`}
                      render={({ field }) => (
                        <Input
                          className="h-8 w-24"
                          type="number"
                          step="0.01"
                          {...field}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`variants.${index}.b2bPrice`}
                      render={({ field }) => (
                        <Input
                          className="h-8 w-24"
                          type="number"
                          step="0.01"
                          {...field}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`variants.${index}.compareAtPrice`}
                      render={({ field }) => (
                        <Input
                          className="h-8 w-24"
                          type="number"
                          step="0.01"
                          {...field}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`variants.${index}.physicalStock`}
                      render={({ field }) => (
                        <div>
                          <Input
                            className="h-8 w-24 bg-muted cursor-not-allowed"
                            type="number"
                            readOnly
                            tabIndex={-1}
                            {...field}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t("products.form.stock_managed_hint")}
                          </p>
                        </div>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
