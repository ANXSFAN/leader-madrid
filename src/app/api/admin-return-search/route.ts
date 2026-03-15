import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const order = await db.order.findFirst({
    where: {
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { id: q },
      ],
    },
    include: {
      user: { select: { name: true, email: true, companyName: true } },
      items: {
        include: {
          variant: {
            select: {
              sku: true,
              product: { select: { content: true, slug: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    const so = await db.salesOrder.findFirst({
      where: {
        orderNumber: { contains: q, mode: "insensitive" },
      },
      select: { orderNumber: true },
    });

    if (so) {
      const linkedOrder = await db.order.findFirst({
        where: { orderNumber: so.orderNumber },
        include: {
          user: { select: { name: true, email: true, companyName: true } },
          items: {
            include: {
              variant: {
                select: {
                  sku: true,
                  product: { select: { content: true, slug: true } },
                },
              },
            },
          },
        },
      });

      if (linkedOrder) {
        return NextResponse.json(formatOrder(linkedOrder));
      }
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(formatOrder(order));
}

function formatOrder(order: {
  id: string;
  orderNumber: string | null;
  user: { name: string | null; email: string; companyName: string | null } | null;
  items: {
    id: string;
    variantId: string;
    name: string | null;
    sku: string | null;
    quantity: number;
    price: { toString(): string };
    variant: {
      sku: string;
      product: { content: unknown; slug: string };
    };
  }[];
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id.slice(0, 8),
    customerName:
      order.user?.companyName || order.user?.name || order.user?.email || "Unknown",
    items: order.items.map((item) => {
      const content = item.variant.product.content as Record<
        string,
        { name?: string }
      > | null;
      const productName =
        item.name ||
        content?.en?.name ||
        content?.es?.name ||
        item.variant.product.slug;
      return {
        id: item.id,
        variantId: item.variantId,
        name: productName,
        sku: item.sku || item.variant.sku,
        quantity: item.quantity,
        price: Number(item.price.toString()),
      };
    }),
  };
}
