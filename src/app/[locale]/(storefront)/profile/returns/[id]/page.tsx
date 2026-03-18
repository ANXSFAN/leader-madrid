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
import { ArrowLeft, RotateCcw, Package, Calendar, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { getSiteSettings } from "@/lib/actions/config";
import { formatMoney, formatDate } from "@/lib/formatters";
import { getTranslations } from "next-intl/server";
import { getItemProductName, getItemProductImage, getItemSku } from "@/lib/utils/product-snapshot";

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  APPROVED: "bg-info/10 text-info hover:bg-info/10",
  REJECTED: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  RECEIVED: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  REFUNDED: "bg-success/10 text-success hover:bg-success/10",
  CLOSED: "bg-muted text-muted-foreground hover:bg-muted",
};

function getStatusIcon(status: string) {
  switch (status) {
    case "REQUESTED":
      return <Clock className="h-4 w-4" />;
    case "APPROVED":
      return <CheckCircle className="h-4 w-4" />;
    case "REJECTED":
      return <XCircle className="h-4 w-4" />;
    case "RECEIVED":
      return <Package className="h-4 w-4" />;
    case "REFUNDED":
      return <CheckCircle className="h-4 w-4" />;
    case "CLOSED":
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

async function getReturnRequest(id: string, userId: string) {
  const ret = await db.returnRequest.findUnique({
    where: { id, userId },
    include: {
      order: {
        include: {
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      },
      items: {
        include: {
          variant: {
            include: { product: true },
          },
        },
      },
    },
  });

  return ret;
}

export default async function ReturnDetailsPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const [returnRequest, settings, t] = await Promise.all([
    getReturnRequest(params.id, session.user.id),
    getSiteSettings(),
    getTranslations("returns"),
  ]);

  if (!returnRequest) {
    notFound();
  }

  const order = returnRequest.order;

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

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/profile" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("back_to_profile")}
        </Link>
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <RotateCcw className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {t("return_number", { number: returnRequest.returnNumber })}
            </h1>
            <p className="text-muted-foreground">
              {t("order_number", { number: order.orderNumber || order.id.slice(0, 8) })}
            </p>
          </div>
        </div>
        <Badge className={STATUS_COLORS[returnRequest.status]}>
          {getStatusIcon(returnRequest.status)}
          <span className="ml-1">{t(`status.${returnRequest.status}` as Parameters<typeof t>[0])}</span>
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("request_details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t("request_date")}</p>
                <p className="font-medium">{fd(returnRequest.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("reason_label")}</p>
              <p className="font-medium">{t(`reason.${returnRequest.reason}` as Parameters<typeof t>[0])}</p>
            </div>

            {returnRequest.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("customer_notes")}</p>
                <p className="text-sm">{returnRequest.notes}</p>
              </div>
            )}

            {returnRequest.adminNotes && (
              <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                <p className="text-sm font-medium text-info mb-1">{t("admin_message")}</p>
                <p className="text-sm text-info">{returnRequest.adminNotes}</p>
              </div>
            )}

            {returnRequest.refundAmount && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("refund_amount")}</p>
                <p className="text-xl font-bold text-success">
                  {fm(returnRequest.refundAmount)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("order_info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span className="font-mono">{fm(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("taxes")}</span>
              <span className="font-mono">{fm(order.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("shipping_cost")}</span>
              <span className="font-mono">{fm(order.shipping)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span>{t("total")}</span>
              <span className="font-mono">{fm(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("items_to_return")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] pl-6">{t("product")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-center">{t("qty")}</TableHead>
                <TableHead className="text-center">{t("condition_label")}</TableHead>
                <TableHead className="text-right pr-6">{t("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnRequest.items.map((item) => {
                const orderItem = order.items.find(
                  (oi) => oi.variantId === item.variantId
                );
                const price = orderItem ? Number(orderItem.price.toString()) : 0;
                const total = price * item.quantity;

                const imageUrl = getItemProductImage(item);
                const productName = getItemProductName(item, params.locale);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 py-4">
                      <div className="relative h-16 w-16 rounded-md overflow-hidden border border-border bg-card">
                        <Image
                          src={imageUrl}
                          alt={productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium">{productName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        SKU: {getItemSku(item)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                        x{item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <Badge variant="outline" className="text-xs">
                        {t(`condition.${item.condition || "NEW"}` as Parameters<typeof t>[0])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 py-4 font-medium font-mono">
                      {fm(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {returnRequest.status === "REQUESTED" && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">{t("pending_review_title")}</h3>
                <p className="text-sm text-amber-700 mt-1">
                  {t("pending_review_desc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
