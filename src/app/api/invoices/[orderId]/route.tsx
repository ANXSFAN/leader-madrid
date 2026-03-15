import { renderToStream } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { getSiteSettings } from "@/lib/actions/config";
import WebOrderInvoicePDF from "@/components/documents/web-order-invoice-pdf";
import React from "react";

export async function GET(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: true,
        shippingAddress: true,
        user: {
          select: {
            name: true,
            email: true,
            companyName: true,
            taxId: true,
          },
        },
      },
    });

    if (!order) {
      return new NextResponse("Order not found", { status: 404 });
    }

    if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const settings = await getSiteSettings();
    const serializedOrder = JSON.parse(JSON.stringify(order));

    const pdfOrder = {
      id: serializedOrder.id,
      orderNumber: serializedOrder.orderNumber,
      createdAt: serializedOrder.createdAt,
      subtotal: serializedOrder.subtotal,
      tax: serializedOrder.tax,
      shipping: serializedOrder.shipping,
      total: serializedOrder.total,
      vatRate: serializedOrder.vatRate ?? 21,
      isReverseCharge: serializedOrder.isReverseCharge ?? false,
      buyerVatNumber: serializedOrder.buyerVatNumber ?? null,
      paymentStatus: serializedOrder.paymentStatus,
      paymentMethod: serializedOrder.paymentMethod,
      poNumber: serializedOrder.poNumber ?? null,
      user: serializedOrder.user ?? null,
      shippingAddress: serializedOrder.shippingAddress ?? null,
      items: (serializedOrder.items ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
    };

    const stream = await renderToStream(
      <WebOrderInvoicePDF order={pdfOrder} settings={settings} />
    );

    // @ts-ignore
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="factura-${order.orderNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
