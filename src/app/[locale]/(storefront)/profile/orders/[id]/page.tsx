import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Package,
  Receipt,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Download,
  RotateCcw,
} from "lucide-react";
import { OrderInvoiceButton } from "@/components/storefront/order-invoice-button";
import { OrderBuyAgainButton } from "@/components/storefront/order-buy-again-button";
import { ReturnButton } from "@/components/storefront/return-button";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney, formatDate } from "@/lib/formatters";
import { getTranslations } from "next-intl/server";
import { getItemProductImage } from "@/lib/utils/product-snapshot";
import { serializeDecimal } from "@/lib/serialize";

async function getOrder(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
      shippingAddress: true,
      billingAddress: true,
      shippingMethod: true,
      returnRequests: {
        where: {
          status: {
            notIn: ["REJECTED", "CLOSED"],
          },
        },
        select: { id: true, status: true, returnNumber: true },
      },
    },
  });

  if (!order) return null;

  // Security check: ensure the order belongs to the current user
  if (order.userId !== userId) {
    return null;
  }

  return order;
}

export default async function OrderDetailsPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${params.locale}/login`);
  }

  const [order, settings, t] = await Promise.all([
    getOrder(params.id, session.user.id),
    getSiteSettings(),
    getTranslations("orders"),
  ]);

  if (!order) {
    notFound();
  }

  const fm = (amount: Parameters<typeof formatMoney>[0]) =>
    formatMoney(amount, { locale: params.locale, currency: settings.currency });
  const fd = (date: Date | string) =>
    formatDate(date, {
      locale: params.locale,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Helper: get status badge using translations
  function getStatusBadge(status: string) {
    const statusKey = `status.${status}` as Parameters<typeof t>[0];
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 gap-1">
            <Clock className="w-3 h-3" /> {t(statusKey)}
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 gap-1">
            <CheckCircle className="w-3 h-3" /> {t(statusKey)}
          </Badge>
        );
      case "SHIPPED":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 gap-1">
            <Truck className="w-3 h-3" /> {t(statusKey)}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" /> {t(statusKey)}
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge className="bg-green-700 hover:bg-green-800 gap-1">
            <CheckCircle className="w-3 h-3" /> {t(statusKey)}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-6 hover:bg-slate-100"
        >
          <Link
            href="/profile"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back_to_orders")}
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900">
              {t("order_number")}{order.orderNumber || order.id.slice(0, 8)}
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("placed_on", { date: fd(order.createdAt) })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              <OrderBuyAgainButton
                items={order.items.map((item) => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                }))}
              />
              {["DELIVERED"].includes(order.status) && (
                <>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Decimal conversion */}
                  <OrderInvoiceButton
                    order={serializeDecimal({
                      ...order,
                      subtotal: Number(order.subtotal.toString()),
                      tax: Number(order.tax.toString()),
                      total: Number(order.total.toString()),
                      items: order.items.map((item) => ({
                        ...item,
                        price: Number(item.price.toString()),
                        total: Number(item.total.toString()),
                      })),
                    }) as any}
                  />
                  {order.returnRequests.length === 0 ? (
                    <ReturnButton orderId={order.id} />
                  ) : (
                    <Link
                      href={`/profile/returns/${order.returnRequests[0].id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("view_request")}
                    </Link>
                  )}
                </>
              )}
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
                  {t("status_label")}
                </span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content: Order Items */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-slate-500" />
                {t("order_items")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[80px] pl-6">{t("product")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead className="text-right">{t("price")}</TableHead>
                      <TableHead className="text-center">{t("qty")}</TableHead>
                      <TableHead className="text-right pr-6">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => {
                      const productName = item.name;
                      const imageUrl = getItemProductImage(item);

                      return (
                        <TableRow
                          key={item.id}
                          className="hover:bg-slate-50/50"
                        >
                          <TableCell className="pl-6 py-4">
                            <div className="relative h-16 w-16 rounded-md overflow-hidden border border-slate-200 bg-white">
                              <Image
                                src={imageUrl}
                                alt={productName}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="font-medium text-slate-900">
                              {productName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              SKU: {item.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4 font-mono text-slate-600">
                            {fm(item.price)}
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              x{item.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-6 py-4 font-medium font-mono">
                            {fm(item.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden divide-y divide-slate-100">
                {order.items.map((item) => {
                  const productName = item.name;
                  const imageUrl = getItemProductImage(item);

                  return (
                    <div key={item.id} className="p-4 flex gap-4">
                      <div className="relative h-20 w-20 rounded-md overflow-hidden border border-slate-200 bg-white shrink-0">
                        <Image
                          src={imageUrl}
                          alt={productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm leading-tight">
                          {productName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                          SKU: {item.sku}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            x{item.quantity}
                          </span>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {fm(item.price)}
                            </div>
                            <div className="font-medium font-mono text-sm">
                              {fm(item.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Summary & Address */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-slate-500" />
                {t("financial_summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span className="font-mono">{fm(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("shipping_cost")}</span>
                <span className="font-mono">{fm(order.shipping)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("tax_vat")}</span>
                <span className="font-mono">{fm(order.tax)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-end pt-2">
                <span className="font-bold text-lg">{t("total")}</span>
                <span className="font-bold text-xl text-primary font-mono">
                  {fm(order.total)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-slate-500" />
                {t("shipping_address")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {order.shippingAddress ? (
                <div className="text-sm space-y-3">
                  <div className="font-medium text-slate-900 border-b pb-2">
                    {order.shippingAddress.firstName}{" "}
                    {order.shippingAddress.lastName}
                    {order.shippingAddress.company && (
                      <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                        {order.shippingAddress.company}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground leading-relaxed">
                    <p>{order.shippingAddress.street}</p>
                    <p>
                      {order.shippingAddress.zipCode}{" "}
                      {order.shippingAddress.city}
                    </p>
                    <p>
                      {order.shippingAddress.state},{" "}
                      {order.shippingAddress.country}
                    </p>
                  </div>
                  {order.shippingAddress.phone && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-medium">Tel:</span>{" "}
                        {order.shippingAddress.phone}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t("no_shipping_address")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-slate-500" />
                {t("shipping_tracking")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {/* Shipping method */}
              {order.shippingMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("method")}</span>
                  <span className="font-medium">{order.shippingMethod.name}</span>
                </div>
              )}

              {/* Tracking number + link */}
              {order.trackingNumber && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">{t("tracking_number")}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-slate-800">{order.trackingNumber}</span>
                    {order.trackingUrl && (
                      <Link
                        href={order.trackingUrl as string}
                        target="_blank"
                        className="text-xs text-primary underline shrink-0"
                      >
                        {t("track")} →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Tracking timeline */}
              <div className="space-y-0 pt-1">
                {(() => {
                  type Step = { label: string; date?: Date | null; done: boolean; active: boolean };
                  const statusOrder = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
                  const currentIdx = statusOrder.indexOf(order.status);
                  const isCancelled = order.status === "CANCELLED";

                  const steps: Step[] = [
                    { label: t("timeline.order_placed"), date: order.createdAt, done: true, active: currentIdx === 0 },
                    { label: t("timeline.confirmed"), date: null, done: currentIdx >= 1, active: currentIdx === 1 },
                    { label: t("timeline.preparing"), date: null, done: currentIdx >= 2, active: currentIdx === 2 },
                    { label: t("timeline.shipped"), date: order.shippedAt, done: currentIdx >= 3, active: currentIdx === 3 },
                    { label: t("timeline.delivered"), date: order.deliveredAt, done: currentIdx >= 4, active: currentIdx === 4 },
                  ];

                  if (isCancelled) {
                    return (
                      <div className="flex items-center gap-2 py-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="font-medium">{t("order_cancelled")}</span>
                      </div>
                    );
                  }

                  return steps.map((step, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      {/* Connector column */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            step.done
                              ? "border-blue-600 bg-blue-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {step.done && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                        {i < steps.length - 1 && (
                          <div
                            className={`w-0.5 h-6 ${
                              steps[i + 1].done ? "bg-blue-600" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                      {/* Label + date */}
                      <div className="pb-1">
                        <p
                          className={`text-sm leading-5 ${
                            step.active
                              ? "font-semibold text-slate-900"
                              : step.done
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.date && (
                          <p className="text-xs text-muted-foreground">
                            {fd(step.date)}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
