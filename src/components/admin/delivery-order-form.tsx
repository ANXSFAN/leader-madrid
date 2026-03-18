"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Truck } from "lucide-react";
import { createDeliveryOrder, getRemainingDeliveryQty } from "@/lib/actions/delivery-order";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const doFormSchema = z.object({
  salesOrderId: z.string().min(1, "Sales Order is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        deliveredQty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
        sku: z.string().optional(),
        name: z.string().optional(),
        orderedQty: z.number().optional(),
        remainingQty: z.number().optional(),
      })
    )
    .min(1, "At least one item is required"),
});

type DOFormValues = z.infer<typeof doFormSchema>;

interface SalesOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  items: {
    variantId: string;
    sku: string;
    name: string;
    quantity: number;
  }[];
}

interface DeliveryOrderFormProps {
  salesOrders: SalesOrderOption[];
  warehouses: { id: string; name: string; code: string; isDefault: boolean }[];
}

interface RemainingItem {
  variantId: string;
  sku: string;
  name: string;
  orderedQty: number;
  deliveredQty: number;
  remainingQty: number;
}

export function DeliveryOrderForm({ salesOrders, warehouses }: DeliveryOrderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [remainingItems, setRemainingItems] = useState<RemainingItem[]>([]);
  const [loadingRemaining, setLoadingRemaining] = useState(false);

  const defaultWarehouse = warehouses.find((w) => w.isDefault);

  const form = useForm<DOFormValues>({
    resolver: zodResolver(doFormSchema),
    defaultValues: {
      salesOrderId: "",
      warehouseId: defaultWarehouse?.id || "",
      items: [],
    },
  });

  const selectedSOId = form.watch("salesOrderId");

  // Load remaining delivery quantities when SO changes
  useEffect(() => {
    if (!selectedSOId) {
      setRemainingItems([]);
      form.setValue("items", []);
      return;
    }

    setLoadingRemaining(true);
    getRemainingDeliveryQty(selectedSOId)
      .then((items) => {
        setRemainingItems(items);
        // Auto-populate form items with remaining quantities (only items that have remaining > 0)
        const formItems = items
          .filter((item) => item.remainingQty > 0)
          .map((item) => ({
            variantId: item.variantId,
            deliveredQty: item.remainingQty,
            sku: item.sku,
            name: item.name,
            orderedQty: item.orderedQty,
            remainingQty: item.remainingQty,
          }));
        form.setValue("items", formItems);
      })
      .catch(() => {
        toast.error("Failed to load remaining quantities");
      })
      .finally(() => {
        setLoadingRemaining(false);
      });
  }, [selectedSOId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: DOFormValues) => {
    try {
      setLoading(true);
      const result = await createDeliveryOrder({
        salesOrderId: data.salesOrderId,
        warehouseId: data.warehouseId,
        items: data.items.map((item) => ({
          variantId: item.variantId,
          deliveredQty: item.deliveredQty,
        })),
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Delivery order created successfully");
      router.push("/admin/delivery-orders");
      router.refresh();
    } catch {
      toast.error("Failed to create delivery order");
    } finally {
      setLoading(false);
    }
  };

  const selectedSO = salesOrders.find((so) => so.id === selectedSOId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* SO & Warehouse Selection */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg border-l-4 border-accent pl-3">
              <Truck className="h-5 w-5 text-accent" />
              Create Delivery Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="salesOrderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Sales Order</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a confirmed sales order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesOrders.map((so) => (
                        <SelectItem key={so.id} value={so.id}>
                          {so.orderNumber} - {so.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Warehouse</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Items */}
        {selectedSOId && (
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg border-l-4 border-accent pl-3">
                <Package className="h-5 w-5 text-accent" />
                Delivery Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRemaining ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading remaining quantities...</span>
                </div>
              ) : remainingItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <div className="rounded-full bg-muted p-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All items in this sales order have been fully delivered.
                  </p>
                </div>
              ) : (
                <Card className="border bg-muted/20">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">SKU</TableHead>
                        <TableHead className="font-semibold">Product</TableHead>
                        <TableHead className="font-semibold text-right">Ordered</TableHead>
                        <TableHead className="font-semibold text-right">Already Delivered</TableHead>
                        <TableHead className="font-semibold text-right">Remaining</TableHead>
                        <TableHead className="font-semibold text-right">Deliver Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remainingItems.map((item, index) => {
                        const formItemIndex = form.getValues("items").findIndex(
                          (fi) => fi.variantId === item.variantId
                        );
                        if (item.remainingQty <= 0) {
                          return (
                            <TableRow key={item.variantId} className="opacity-50">
                              <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                              <TableCell className="text-sm">{item.name}</TableCell>
                              <TableCell className="text-right font-mono">{item.orderedQty}</TableCell>
                              <TableCell className="text-right font-mono">{item.deliveredQty}</TableCell>
                              <TableCell className="text-right font-mono">0</TableCell>
                              <TableCell className="text-right text-muted-foreground text-sm">
                                Fully delivered
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={item.variantId} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-sm font-medium">{item.sku}</TableCell>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.orderedQty}</TableCell>
                            <TableCell className="text-right font-mono">{item.deliveredQty}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{item.remainingQty}</TableCell>
                            <TableCell className="text-right">
                              {formItemIndex >= 0 && (
                                <FormField
                                  control={form.control}
                                  name={`items.${formItemIndex}.deliveredQty`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          max={item.remainingQty}
                                          className="w-24 h-9 text-right font-mono ml-auto"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        {selectedSOId && remainingItems.some((i) => i.remainingQty > 0) && (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading || loadingRemaining}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-black min-w-[160px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Delivery Order"
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
