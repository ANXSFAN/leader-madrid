import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  User,
  Mail,
  Briefcase,
  ShieldCheck,
  ShoppingBag,
  FileText,
  MapPin,
  Eye,
  RotateCcw,
  Heart,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserInvoices } from "@/lib/actions/invoice";
import { getUserReturns } from "@/lib/actions/returns";
import { getUserAddresses } from "@/lib/actions/address";
import { getSiteSettings } from "@/lib/actions/config";
import { InvoiceList } from "@/components/storefront/profile/invoice-list";
import { AddressList } from "@/components/storefront/profile/address-list";
import { formatMoney, formatDate } from "@/lib/formatters";
import { getTranslations } from "next-intl/server";
import { labelCode } from "@/lib/i18n-labels";
import { OrderBuyAgainButton } from "@/components/storefront/order-buy-again-button";
import { serializeDecimal } from "@/lib/serialize";
import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "profile" });
  return { title: t("title"), robots: { index: false } };
}

async function getOrders(userId: string) {
  return await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });
}

function getOrderStatusBadge(status: string, label: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{label}</Badge>;
    case "CONFIRMED":
      return <Badge className="bg-blue-500 hover:bg-blue-600">{label}</Badge>;
    case "PROCESSING":
      return <Badge className="bg-blue-400 hover:bg-blue-500">{label}</Badge>;
    case "SHIPPED":
      return <Badge className="bg-green-500 hover:bg-green-600">{label}</Badge>;
    case "DELIVERED":
      return <Badge className="bg-emerald-600 hover:bg-emerald-700">{label}</Badge>;
    case "RETURNED":
      return <Badge className="bg-orange-500 hover:bg-orange-600">{label}</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">{label}</Badge>;
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

export default async function ProfilePage(
  props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect({ href: "/login", locale: params.locale });
  }

  const { user } = session!;
  const b2bStatus = user.b2bStatus || "NOT_APPLIED";

  const [orders, invoices, addresses, settings, returns, tProfile, tOrders, tReturns, tB2b] =
    await Promise.all([
      getOrders(user.id),
      getUserInvoices(user.id),
      getUserAddresses(user.id),
      getSiteSettings(),
      getUserReturns(user.id),
      getTranslations("profile"),
      getTranslations("orders"),
      getTranslations("returns"),
      getTranslations("b2b"),
    ]);

  const { locale } = params;
  const fm = (amount: Parameters<typeof formatMoney>[0]) =>
    formatMoney(amount, { locale, currency: settings.currency });
  const fd = (date: Date | string) =>
    formatDate(date, { locale, year: "numeric", month: "2-digit", day: "2-digit" });

  const defaultTab = typeof searchParams.tab === "string" ? searchParams.tab : "overview";

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">{tProfile("title")}</h1>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{tProfile("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="orders">{tProfile("tabs.orders")}</TabsTrigger>
          <TabsTrigger value="invoices">{tProfile("tabs.invoices")}</TabsTrigger>
          <TabsTrigger value="addresses">{tProfile("tabs.addresses")}</TabsTrigger>
          <TabsTrigger value="returns">{tProfile("tabs.returns")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {tProfile("info.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> {tProfile("info.name")}
                  </span>
                  <span className="font-medium">{user.name}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {tProfile("info.email")}
                  </span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> {tProfile("info.role")}
                  </span>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  {tProfile("b2b.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">
                    {tProfile("b2b.request_status")}
                  </span>
                  <Badge
                    variant={
                      b2bStatus === "APPROVED"
                        ? "default"
                        : b2bStatus === "PENDING"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {labelCode(tB2b as (key: string) => string, "status", b2bStatus)}
                  </Badge>
                </div>
                {b2bStatus === "NOT_APPLIED" && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {tProfile("b2b.not_applied_desc")}
                    </p>
                    <Link href="/apply-b2b">
                      <Button className="w-full">{tProfile("b2b.apply_button")}</Button>
                    </Link>
                  </div>
                )}
                {b2bStatus === "APPROVED" && (
                  <div className="mt-4">
                    <p className="text-sm text-green-600 mb-2">
                      {tProfile("b2b.approved_msg")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Wishlist Quick Access */}
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                  <Heart className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {tProfile("wishlist.title")}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {tProfile("wishlist.empty_desc")}
                  </p>
                </div>
              </div>
              <Link href="/profile/wishlist">
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  {tProfile("orders.view")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                {tProfile("orders.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <ShoppingBag className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {tProfile("orders.empty_title")}
                  </h3>
                  <p className="text-slate-500 mb-8 max-w-md">
                    {tProfile("orders.empty_desc")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild variant="outline">
                      <Link href="/category/iluminacion-led">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        {tProfile("orders.browse_led")}
                      </Link>
                    </Button>
                    <Button asChild className="bg-yellow-500 hover:bg-yellow-600">
                      <Link href="/">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        {tProfile("orders.start_shopping")}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tProfile("orders.col_id")}</TableHead>
                        <TableHead>{tProfile("orders.col_date")}</TableHead>
                        <TableHead>{tProfile("orders.col_status")}</TableHead>
                        <TableHead>{tProfile("orders.col_total")}</TableHead>
                        <TableHead className="text-right">{tProfile("orders.col_actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>{fd(order.createdAt)}</TableCell>
                          <TableCell>
                            {getOrderStatusBadge(
                              order.status,
                              labelCode(tOrders as (key: string) => string, "status", order.status)
                            )}
                          </TableCell>
                          <TableCell>{fm(Number(order.total))}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <OrderBuyAgainButton
                                items={order.items.map((item) => ({
                                  variantId: item.variantId,
                                  quantity: item.quantity,
                                }))}
                              />
                              <Link href={`/profile/orders/${order.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4 mr-2" />
                                  {tProfile("orders.view")}
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {tProfile("invoices.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceList invoices={serializeDecimal(invoices)} settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {tProfile("addresses.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddressList userId={user.id} addresses={addresses} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {tProfile("returns.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <RotateCcw className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {tProfile("returns.empty_title")}
                  </h3>
                  <p className="text-slate-500 mb-4 max-w-md">
                    {tProfile("returns.empty_desc")}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tProfile("returns.col_number")}</TableHead>
                        <TableHead>{tProfile("returns.col_order")}</TableHead>
                        <TableHead>{tProfile("returns.col_date")}</TableHead>
                        <TableHead>{tProfile("returns.col_status")}</TableHead>
                        <TableHead className="text-right">{tProfile("returns.col_actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="font-medium">
                            {ret.returnNumber}
                          </TableCell>
                          <TableCell>
                            #{ret.order?.orderNumber || ret.orderId.slice(0, 8)}
                          </TableCell>
                          <TableCell>{fd(ret.createdAt)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                ret.status === "REQUESTED"
                                  ? "bg-amber-100 text-amber-800"
                                  : ret.status === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : ret.status === "REJECTED"
                                      ? "bg-red-100 text-red-800"
                                      : ret.status === "REFUNDED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-slate-100 text-slate-600"
                              }
                            >
                              {labelCode(tReturns as (key: string) => string, "status", ret.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/profile/returns/${ret.id}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                {tProfile("returns.view")}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
