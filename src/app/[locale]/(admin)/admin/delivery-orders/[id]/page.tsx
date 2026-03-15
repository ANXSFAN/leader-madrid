import { getDeliveryOrder } from "@/lib/actions/delivery-order";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { DeliveryOrderActions } from "@/components/admin/delivery-order-actions";
import { Package, Truck, MapPin, Clock } from "lucide-react";

interface DeliveryOrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "DRAFT":
      return "outline" as const;
    case "CONFIRMED":
      return "default" as const;
    case "PICKING":
      return "secondary" as const;
    case "PACKED":
      return "secondary" as const;
    case "SHIPPED":
      return "default" as const;
    case "DELIVERED":
      return "default" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export default async function DeliveryOrderDetailPage(props: DeliveryOrderDetailPageProps) {
  const params = await props.params;
  const doOrder = await getDeliveryOrder(params.id);

  if (!doOrder) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title={`Delivery Order ${doOrder.deliveryNumber}`}
        breadcrumbs={[
          { label: "Delivery Orders", href: "/admin/delivery-orders" },
          { label: doOrder.deliveryNumber },
        ]}
        actions={
          <DeliveryOrderActions
            deliveryOrder={{
              id: doOrder.id,
              status: doOrder.status,
              deliveryNumber: doOrder.deliveryNumber,
            }}
          />
        }
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Order Info */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm border-l-4 border-yellow-500 pl-3">
              <Package className="h-4 w-4 text-yellow-600" />
              Order Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">DO Number</span>
              <span className="font-mono font-medium">{doOrder.deliveryNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sales Order</span>
              <Link
                href={`/admin/sales-orders/${doOrder.salesOrder.id}`}
                className="text-blue-600 hover:underline font-mono"
              >
                {doOrder.salesOrder.orderNumber}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span>{doOrder.salesOrder.customer?.companyName || doOrder.salesOrder.customer?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={getStatusVariant(doOrder.status)}
                className={doOrder.status === "DELIVERED" ? "bg-green-100 text-green-800 hover:bg-green-100" : undefined}
              >
                {doOrder.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm border-l-4 border-yellow-500 pl-3">
              <MapPin className="h-4 w-4 text-yellow-600" />
              Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{doOrder.warehouse.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-mono">{doOrder.warehouse.code}</span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping / Timestamps */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm border-l-4 border-yellow-500 pl-3">
              <Truck className="h-4 w-4 text-yellow-600" />
              Shipping Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {doOrder.trackingNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracking #</span>
                <span className="font-mono">{doOrder.trackingNumber}</span>
              </div>
            )}
            {doOrder.carrierName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carrier</span>
                <span>{doOrder.carrierName}</span>
              </div>
            )}
            {!doOrder.trackingNumber && !doOrder.carrierName && (
              <p className="text-muted-foreground italic">No shipping info yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm border-l-4 border-yellow-500 pl-3">
            <Clock className="h-4 w-4 text-yellow-600" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="font-medium">{format(doOrder.createdAt, "yyyy-MM-dd HH:mm")}</span>
            </div>
            {doOrder.confirmedAt && (
              <div>
                <span className="text-muted-foreground">Confirmed: </span>
                <span className="font-medium">{format(doOrder.confirmedAt, "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
            {doOrder.pickedAt && (
              <div>
                <span className="text-muted-foreground">Picking: </span>
                <span className="font-medium">{format(doOrder.pickedAt, "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
            {doOrder.packedAt && (
              <div>
                <span className="text-muted-foreground">Packed: </span>
                <span className="font-medium">{format(doOrder.packedAt, "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
            {doOrder.shippedAt && (
              <div>
                <span className="text-muted-foreground">Shipped: </span>
                <span className="font-medium">{format(doOrder.shippedAt, "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
            {doOrder.deliveredAt && (
              <div>
                <span className="text-muted-foreground">Delivered: </span>
                <span className="font-medium">{format(doOrder.deliveredAt, "yyyy-MM-dd HH:mm")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm border-l-4 border-yellow-500 pl-3">
            <Package className="h-4 w-4 text-yellow-600" />
            Delivery Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold text-right">Ordered Qty</TableHead>
                <TableHead className="font-semibold text-right">Delivered Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doOrder.items.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm font-medium">
                    {item.sku || item.variant?.sku || "-"}
                  </TableCell>
                  <TableCell>
                    {item.name || item.variant?.product?.slug || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.orderedQty}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {item.deliveredQty}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
