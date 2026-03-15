"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Check } from "lucide-react";
import { Supplier } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useTranslations } from "next-intl";

interface ProductSuppliersManagerProps {
  name: string;
  suppliers: Supplier[];
}

export function ProductSuppliersManager({
  name,
  suppliers,
}: ProductSuppliersManagerProps) {
  const { control, watch, setValue } = useFormContext();
  const t = useTranslations("admin.products.form.suppliers");
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  // Watch fields to enforce single primary supplier
  const supplierFields = watch(name) || [];

  const handlePrimaryChange = (index: number, checked: boolean) => {
    if (checked) {
      // Uncheck all others
      fields.forEach((_, i) => {
        if (i !== index) {
          setValue(`${name}.${i}.isPrimary`, false);
        }
      });
    }
    setValue(`${name}.${index}.isPrimary`, checked);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              supplierId: "",
              supplierSku: "",
              costPrice: 0,
              moq: 1,
              isPrimary: false,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">{t("supplier")}</TableHead>
              <TableHead>{t("supplier_sku")}</TableHead>
              <TableHead className="w-[100px]">{t("cost")}</TableHead>
              <TableHead className="w-[80px]">{t("moq")}</TableHead>
              <TableHead className="w-[80px]">{t("primary")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <FormField
                    control={control}
                    name={`${name}.${index}.supplierId`}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("select_supplier")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`${name}.${index}.supplierSku`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder={t("sku_placeholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`${name}.${index}.costPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`${name}.${index}.moq`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" {...field} placeholder="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`${name}.${index}.isPrimary`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div
                            role="radio"
                            aria-checked={field.value}
                            tabIndex={0}
                            onClick={() => handlePrimaryChange(index, true)}
                            className={cn(
                              "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center justify-center",
                              field.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-transparent"
                            )}
                          >
                            {field.value && (
                              <div className="h-2.5 w-2.5 rounded-full bg-white" />
                            )}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {fields.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground h-24"
                >
                  {t("no_suppliers")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
