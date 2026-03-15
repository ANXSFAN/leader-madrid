import db from "@/lib/db";
import { DeliveryOrderForm } from "@/components/admin/delivery-order-form";
import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { PageHeader } from "@/components/admin/page-header";

export default async function NewDeliveryOrderPage() {
  const [salesOrders, warehouses] = await Promise.all([
    db.salesOrder.findMany({
      where: { status: "CONFIRMED" },
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        items: {
          select: {
            id: true,
            variantId: true,
            sku: true,
            name: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getActiveWarehouses(),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader
        title="Create Delivery Order"
        breadcrumbs={[
          { label: "Delivery Orders", href: "/admin/delivery-orders" },
          { label: "New" },
        ]}
      />
      <DeliveryOrderForm
        salesOrders={salesOrders.map((so) => ({
          id: so.id,
          orderNumber: so.orderNumber,
          customerName: so.customer?.companyName || so.customer?.name || "N/A",
          items: so.items.map((item) => ({
            variantId: item.variantId,
            sku: item.sku || "",
            name: item.name || "",
            quantity: item.quantity,
          })),
        }))}
        warehouses={warehouses}
      />
    </div>
  );
}
