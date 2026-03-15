"use client";

import { useFieldArray, Control, FieldErrors } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface CustomsItemsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: FieldErrors<any>;
}

export function CustomsItemsTable({ control }: CustomsItemsTableProps) {
  const t = useTranslations("admin.customs.form");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="pb-2 pr-2 font-medium">{t("item_product_name")}</th>
              <th className="pb-2 pr-2 font-medium">{t("item_sku")}</th>
              <th className="pb-2 pr-2 font-medium">{t("item_hs_code")}</th>
              <th className="pb-2 pr-2 font-medium w-20">{t("item_quantity")}</th>
              <th className="pb-2 pr-2 font-medium w-24">{t("item_unit_price")}</th>
              <th className="pb-2 pr-2 font-medium w-24">{t("item_total_value")}</th>
              <th className="pb-2 pr-2 font-medium w-20">{t("item_weight")}</th>
              <th className="pb-2 pr-2 font-medium">{t("item_origin")}</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id} className="border-b last:border-0">
                <td className="py-1.5 pr-2">
                  <Input {...control.register(`items.${index}.productName`)} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input {...control.register(`items.${index}.sku`)} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input {...control.register(`items.${index}.hsCode`)} placeholder="9405.42" className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input type="number" {...control.register(`items.${index}.quantity`, { valueAsNumber: true })} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input type="number" step="0.01" {...control.register(`items.${index}.unitPrice`, { valueAsNumber: true })} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input type="number" step="0.01" {...control.register(`items.${index}.totalValue`, { valueAsNumber: true })} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input type="number" step="0.001" {...control.register(`items.${index}.weight`, { valueAsNumber: true })} className="h-8 text-xs" />
                </td>
                <td className="py-1.5 pr-2">
                  <Input {...control.register(`items.${index}.countryOfOrigin`)} placeholder="CN" className="h-8 text-xs" />
                </td>
                <td className="py-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="h-7 w-7 p-0 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ productName: "", sku: "", hsCode: "", quantity: 1, unitPrice: 0, totalValue: 0, weight: 0, countryOfOrigin: "CN" })}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> {t("add_item")}
      </Button>
    </div>
  );
}
