"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Order,
  OrderItem,
  Product,
  ProductVariant,
  User,
  Address,
  ShippingMethod,
  ShippingStatus,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updateOrderShipping } from "@/lib/actions/shipping";
import { createShipmentAction } from "@/lib/actions/logistics";
import { useTranslations, useLocale } from "next-intl";
import { formatMoney } from "@/lib/formatters";
import { OrderNotes } from "@/components/admin/order-notes";
import { getItemProductName, getItemProductImage, getItemSku } from "@/lib/utils/product-snapshot";

type OrderWithDetails = Order & {
  user: User | null;
  items: (OrderItem & {
    variant: ProductVariant & {
      product: Product;
    };
  })[];
  shippingAddress: Address | null;
  shippingMethod: ShippingMethod | null;
  internalNotes?: string | null;
};

type ShippingMethodOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDays: number | null;
  isDefault: boolean;
};

type CarrierShippingMethod = {
  id: number;
  name: string;
  carrier: string;
  min_weight: string;
  max_weight: string;
  price: number;
};

type ServicePoint = {
  id: number;
  name: string;
  street: string;
  house_number: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
};

interface OrderDetailsProps {
  order: OrderWithDetails;
  shippingMethods: ShippingMethodOption[];
  currency?: string;
}

export function OrderDetails({ order, shippingMethods, currency = "EUR" }: OrderDetailsProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin.orders");
  const fmt = (amount: number | string) => formatMoney(amount, { locale, currency });
  const [saving, setSaving] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [carrierMethods, setCarrierMethods] = useState<CarrierShippingMethod[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loadingServicePoints, setLoadingServicePoints] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    shippingMethodId: order.shippingMethodId ?? "",
    trackingNumber: order.trackingNumber ?? "",
    trackingUrl: order.trackingUrl ?? "",
    shippingStatus: order.shippingStatus ?? "PENDING",
  });
  const [parcelForm, setParcelForm] = useState({
    name: order.shippingAddress
      ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
      : "",
    address: order.shippingAddress?.street ?? "",
    house_number: "",
    city: order.shippingAddress?.city ?? "",
    postal_code: order.shippingAddress?.zipCode ?? "",
    country: order.shippingAddress?.country ?? "ES",
    telephone: order.shippingAddress?.phone ?? "",
    email: order.user?.email ?? "",
    weight: "1.000",
    shipmentId: "",
    servicePointId: "",
  });

  const statusBadge = useMemo(() => {
    switch (order.status) {
      case "PENDING":   return <Badge variant="outline">{t("detail.status_options.PENDING")}</Badge>;
      case "CONFIRMED": return <Badge className="bg-blue-500">{t("detail.status_options.CONFIRMED")}</Badge>;
      case "SHIPPED":   return <Badge className="bg-green-600">{t("detail.status_options.SHIPPED")}</Badge>;
      case "DELIVERED": return <Badge className="bg-green-700">{t("detail.status_options.DELIVERED")}</Badge>;
      case "CANCELLED": return <Badge variant="destructive">{t("detail.status_options.CANCELLED")}</Badge>;
      default:          return <Badge variant="secondary">{t(`detail.status_options.${order.status}`)}</Badge>;
    }
  }, [order.status, t]);

  useEffect(() => {
    let mounted = true;
    const loadCarrierMethods = async () => {
      try {
        const res = await fetch("/api/logistics/shipping-methods");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data.data)) {
          setCarrierMethods(data.data);
        }
      } catch (err) {}
    };
    loadCarrierMethods();
    return () => { mounted = false; };
  }, []);

  const loadServicePoints = async () => {
    if (!parcelForm.country || !parcelForm.postal_code) {
      toast.error(t("detail.toast.fill_country_postal"));
      return;
    }
    setLoadingServicePoints(true);
    try {
      const params = new URLSearchParams({
        country: parcelForm.country,
        postal_code: parcelForm.postal_code,
      });
      const res = await fetch(`/api/logistics/service-points?${params.toString()}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setServicePoints(data.data);
        if (data.data.length === 0) toast.info(t("detail.toast.no_service_points"));
      } else {
        toast.error(data?.error?.message || t("detail.toast.load_points_error"));
      }
    } catch (err) {
      toast.error(t("detail.toast.load_points_error"));
    } finally {
      setLoadingServicePoints(false);
    }
  };

  const handleSaveShipping = async () => {
    setSaving(true);
    try {
      const result = await updateOrderShipping(order.id, {
        shippingMethodId: shippingForm.shippingMethodId || undefined,
        trackingNumber:   shippingForm.trackingNumber   || undefined,
        trackingUrl:      shippingForm.trackingUrl      || undefined,
        shippingStatus:   shippingForm.shippingStatus   || undefined,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success(t("detail.toast.shipping_updated"));
      router.refresh();
    } catch (err) {
      toast.error(t("detail.toast.shipping_update_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!parcelForm.shipmentId) {
      toast.error(t("detail.toast.select_carrier_method")); return;
    }
    if (!parcelForm.address || !parcelForm.city || !parcelForm.postal_code) {
      toast.error(t("detail.toast.fill_address")); return;
    }
    setCreatingShipment(true);
    try {
      const result = await createShipmentAction({
        name:         parcelForm.name,
        address:      parcelForm.address,
        house_number: parcelForm.house_number || undefined,
        city:         parcelForm.city,
        postal_code:  parcelForm.postal_code,
        country:      parcelForm.country,
        telephone:    parcelForm.telephone,
        email:        parcelForm.email,
        weight:       parcelForm.weight,
        shipment:     { id: Number(parcelForm.shipmentId) },
        to_service_point: parcelForm.servicePointId ? Number(parcelForm.servicePointId) : undefined,
      });

      if (!result.success) { toast.error(result.error); return; }

      const parcel = result.parcel;
      const updateResult = await updateOrderShipping(order.id, {
        trackingNumber: parcel.tracking_number,
        trackingUrl:    parcel.tracking_url,
        shippingStatus: "SHIPPED",
      });

      if (updateResult.error) { toast.error(updateResult.error); return; }

      setShippingForm((prev) => ({
        ...prev,
        trackingNumber: parcel.tracking_number,
        trackingUrl:    parcel.tracking_url,
        shippingStatus: "SHIPPED",
      }));

      toast.success(t("detail.toast.shipment_created"));
      router.refresh();
    } catch (err) {
      toast.error(t("detail.toast.shipment_error"));
    } finally {
      setCreatingShipment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("detail.order_number", { number: order.orderNumber })}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("detail.customer_label")} {order.user?.name || order.user?.email || t("detail.guest")}
          </p>
        </div>
        {statusBadge}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.items_title")}</CardTitle>
              <CardDescription>{t("detail.items_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.product")}</TableHead>
                    <TableHead>{t("detail.sku")}</TableHead>
                    <TableHead className="text-right">{t("detail.qty")}</TableHead>
                    <TableHead className="text-right">{t("detail.price")}</TableHead>
                    <TableHead className="text-right">{t("detail.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const productName = getItemProductName(item, locale);
                    const imageUrl = getItemProductImage(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 rounded-md overflow-hidden border border-slate-200 bg-white shrink-0">
                              <Image
                                src={imageUrl}
                                alt={productName}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {productName}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {getItemSku(item)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(Number(item.price))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(Number(item.total))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.shipping_title")}</CardTitle>
              <CardDescription>{t("detail.shipping_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("detail.shipping_method")}</Label>
                <Select
                  value={shippingForm.shippingMethodId}
                  onValueChange={(val) =>
                    setShippingForm((prev) => ({
                      ...prev,
                      shippingMethodId: val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("detail.select_method")} />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name} · {fmt(Number(method.price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("detail.tracking_number")}</Label>
                  <Input
                    value={shippingForm.trackingNumber}
                    onChange={(e) =>
                      setShippingForm((prev) => ({
                        ...prev,
                        trackingNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.tracking_url")}</Label>
                  <Input
                    value={shippingForm.trackingUrl}
                    onChange={(e) =>
                      setShippingForm((prev) => ({
                        ...prev,
                        trackingUrl: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("detail.shipping_status")}</Label>
                <Select
                  value={shippingForm.shippingStatus}
                  onValueChange={(val) =>
                    setShippingForm((prev) => ({
                      ...prev,
                      shippingStatus: val as ShippingStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("detail.select_status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{t("detail.shipping_status_options.PENDING")}</SelectItem>
                    <SelectItem value="PROCESSING">{t("detail.shipping_status_options.PROCESSING")}</SelectItem>
                    <SelectItem value="SHIPPED">{t("detail.shipping_status_options.SHIPPED")}</SelectItem>
                    <SelectItem value="IN_TRANSIT">{t("detail.shipping_status_options.IN_TRANSIT")}</SelectItem>
                    <SelectItem value="DELIVERED">{t("detail.shipping_status_options.DELIVERED")}</SelectItem>
                    <SelectItem value="RETURNED">{t("detail.shipping_status_options.RETURNED")}</SelectItem>
                    <SelectItem value="FAILED">{t("detail.shipping_status_options.FAILED")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveShipping} disabled={saving}>
                  {saving ? t("detail.saving") : t("detail.save_shipping")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.logistics_title")}</CardTitle>
              <CardDescription>{t("detail.logistics_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("detail.name")}</Label>
                  <Input
                    value={parcelForm.name}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.email")}</Label>
                  <Input
                    value={parcelForm.email}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.address")}</Label>
                  <Input
                    value={parcelForm.address}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.house_number")}</Label>
                  <Input
                    value={parcelForm.house_number}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        house_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.city")}</Label>
                  <Input
                    value={parcelForm.city}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.postal_code")}</Label>
                  <Input
                    value={parcelForm.postal_code}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        postal_code: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.country")}</Label>
                  <Input
                    value={parcelForm.country}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.phone")}</Label>
                  <Input
                    value={parcelForm.telephone}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        telephone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.weight")}</Label>
                  <Input
                    value={parcelForm.weight}
                    onChange={(e) =>
                      setParcelForm((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("detail.carrier_method")}</Label>
                  <Select
                    value={parcelForm.shipmentId}
                    onValueChange={(val) =>
                      setParcelForm((prev) => ({ ...prev, shipmentId: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("detail.select_method")} />
                    </SelectTrigger>
                    <SelectContent>
                      {carrierMethods.map((method) => (
                        <SelectItem key={method.id} value={String(method.id)}>
                          {method.name} · {method.carrier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("detail.service_point")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadServicePoints}
                    disabled={loadingServicePoints}
                  >
                    {loadingServicePoints ? t("detail.searching") : t("detail.search_points")}
                  </Button>
                </div>
                <Select
                  value={parcelForm.servicePointId}
                  onValueChange={(val) =>
                    setParcelForm((prev) => ({ ...prev, servicePointId: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("detail.optional")} />
                  </SelectTrigger>
                  <SelectContent>
                    {servicePoints.map((point) => (
                      <SelectItem key={point.id} value={String(point.id)}>
                        {point.name} · {point.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleCreateShipment}
                  disabled={creatingShipment}
                >
                  {creatingShipment ? t("detail.creating") : t("detail.create_shipment")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.summary_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t("detail.subtotal")}</span>
                <span>{fmt(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("detail.shipping")}</span>
                <span>{fmt(Number(order.shipping))}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("detail.tax")}</span>
                <span>{fmt(Number(order.tax))}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("detail.total")}</span>
                <span>{fmt(Number(order.total))}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.shipping_address_title")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {order.shippingAddress ? (
                <>
                  <div>
                    {order.shippingAddress.firstName}{" "}
                    {order.shippingAddress.lastName}
                  </div>
                  <div>{order.shippingAddress.street}</div>
                  <div>
                    {order.shippingAddress.zipCode} {order.shippingAddress.city}
                  </div>
                  <div>{order.shippingAddress.country}</div>
                  {order.shippingAddress.phone && (
                    <div>{order.shippingAddress.phone}</div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">{t("detail.no_address")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.tracking_title")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">{t("detail.tracking_number_label")}</span>
                <div>{order.trackingNumber || "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t("detail.tracking_url_label")}</span>
                <div className="break-all">{order.trackingUrl || "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t("detail.status_label")}</span>
                <div>{order.shippingStatus}</div>
              </div>
            </CardContent>
          </Card>

          <OrderNotes
            orderId={order.id}
            initialNotes={order.internalNotes || ""}
          />
        </div>
      </div>
    </div>
  );
}
