import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDeliveryOrders } from "@/lib/actions/delivery-order";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";

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

export default async function DeliveryOrdersPage() {
  const orders = await getDeliveryOrders();

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title="Delivery Orders"
        actions={
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
            <Link href="/admin/delivery-orders/new">
              <Plus className="mr-2 h-4 w-4" /> Create Delivery Order
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DO Number</TableHead>
              <TableHead>SO Number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((doOrder) => (
              <TableRow key={doOrder.id}>
                <TableCell className="font-medium font-mono">
                  {doOrder.deliveryNumber}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/sales-orders/${doOrder.salesOrder.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {doOrder.salesOrder.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {doOrder.warehouse.name} ({doOrder.warehouse.code})
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getStatusVariant(doOrder.status)}
                    className={doOrder.status === "DELIVERED" ? "bg-green-100 text-green-800 hover:bg-green-100" : undefined}
                  >
                    {doOrder.status}
                  </Badge>
                </TableCell>
                <TableCell>{doOrder.items.length}</TableCell>
                <TableCell>{format(doOrder.createdAt, "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/delivery-orders/${doOrder.id}`}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  No delivery orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
