import db from "@/lib/db";
import { notFound } from "next/navigation";
import { OrderDetails } from "@/components/admin/order-details";
import { OrderComments } from "@/components/admin/order-comments";
import { serializeDecimal } from "@/lib/serialize";
import { getOrderComments } from "@/lib/actions/order-comments";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminOrderDetailPage(props: PageProps) {
  const params = await props.params;
  const [order, shippingMethods, comments] = await Promise.all([
    db.order.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        shippingAddress: true,
        shippingMethod: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    }),
    db.shippingMethod.findMany({
      orderBy: [{ isDefault: "desc" }, { price: "asc" }],
    }),
    getOrderComments(params.id),
  ]);

  if (!order) {
    notFound();
  }

  const safeMethods = shippingMethods.map((method) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    price: Number(method.price),
    estimatedDays: method.estimatedDays,
    isDefault: method.isDefault,
  }));

  return (
    <div className="flex-1 space-y-4">
      <OrderDetails order={serializeDecimal(order)} shippingMethods={safeMethods} />
      <OrderComments
        orderId={params.id}
        initialComments={comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
