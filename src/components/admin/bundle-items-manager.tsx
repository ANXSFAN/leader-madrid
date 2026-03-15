"use client";

import { useState, useEffect } from "react";
import { useFieldArray, Control, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash, Search, Loader2 } from "lucide-react";
import { searchVariantsForBundle } from "@/lib/actions/product";
import { useTranslations } from "next-intl";

interface BundleItemsManagerProps {
  control: Control<any>;
  name: string;
}

export function BundleItemsManager({ control, name }: BundleItemsManagerProps) {
  const t = useTranslations("admin");
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (search.length > 2) {
        setLoading(true);
        try {
          const res = await searchVariantsForBundle(search);
          setResults(res);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleAdd = (variant: any) => {
    // Check if already exists
    const exists = fields.find((f: any) => f.childId === variant.id);
    if (!exists) {
      append({
        childId: variant.id,
        sku: variant.sku,
        productName: variant.productName,
        quantity: 1,
      });
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("products.form.bundle.title")}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("products.form.bundle.add_component")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("products.form.bundle.add_title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("products.form.bundle.search_placeholder")}
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {loading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length > 0 ? (
                  results.map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      variant="ghost"
                      className="w-full justify-start text-left font-normal"
                      onClick={() => handleAdd(v)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{v.sku}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.productName}
                        </span>
                      </div>
                    </Button>
                  ))
                ) : (
                  search.length > 2 && (
                    <p className="text-center py-4 text-sm text-muted-foreground">
                      {t("products.form.bundle.no_variant")}
                    </p>
                  )
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.table.sku")}</TableHead>
              <TableHead>{t("products.table.name")}</TableHead>
              <TableHead className="w-[100px]">{t("products.form.bundle.quantity")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell className="font-mono text-xs">
                  {(field as any).sku}
                </TableCell>
                <TableCell className="text-xs">
                  {(field as any).productName}
                </TableCell>
                <TableCell>
                  <Controller
                    control={control}
                    name={`${name}.${index}.quantity`}
                    render={({ field: qtyField }) => (
                      <Input
                        type="number"
                        className="h-8"
                        min={1}
                        {...qtyField}
                        onChange={(e) =>
                          qtyField.onChange(parseInt(e.target.value) || 1)
                        }
                      />
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
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {fields.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("products.form.bundle.no_components")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
