"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { RFQStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { generateOrderNumber } from "@/lib/utils/order-number";

const rfqItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  variantId: z.string().optional(),
  variantSku: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  targetPrice: z.number().optional(),
});

const createRFQSchema = z.object({
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().default("ES"),
  message: z.string().optional(),
  items: z.array(rfqItemSchema).min(1),
});

export async function createRFQ(data: unknown) {
  const session = await getServerSession(authOptions);

  const parsed = createRFQSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data. Please check all fields." };
  }

  const { items, ...rest } = parsed.data;

  try {
    const rfq = await db.rFQRequest.create({
      data: {
        ...rest,
        userId: session?.user?.id ?? null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId ?? null,
            variantSku: item.variantSku ?? null,
            quantity: item.quantity,
            targetPrice: item.targetPrice ?? null,
          })),
        },
      },
      include: { items: true },
    });

    // Send confirmation email to customer (non-blocking)
    import("@/lib/email")
      .then(({ sendRFQConfirmationEmail, sendRFQAdminNotificationEmail }) => {
        // Customer confirmation
        sendRFQConfirmationEmail({
          to: rest.contactEmail,
          customerName: rest.contactName,
          rfqNumber: rfq.id.slice(0, 8).toUpperCase(),
          itemCount: items.length,
        }).catch((err) => console.error("RFQ confirmation email failed:", err));

        // Admin notification
        sendRFQAdminNotificationEmail({
          contactName: rest.contactName,
          contactEmail: rest.contactEmail,
          companyName: rest.companyName,
          itemCount: items.length,
          rfqId: rfq.id,
        }).catch((err) => console.error("RFQ admin notification email failed:", err));
      })
      .catch((e) => console.error("RFQ email import failed:", e));

    return { success: true, id: rfq.id };
  } catch (e: unknown) {
    console.error("Failed to create RFQ:", e);
    return { error: "Failed to submit quote request. Please try again." };
  }
}

export async function getRFQList(page = 1, status?: RFQStatus) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { requests: [], total: 0, pages: 0 };

  const pageSize = 20;
  const where = status ? { status } : {};

  const [requests, total] = await Promise.all([
    db.rFQRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, name: true, companyName: true } },
        items: { select: { productName: true, quantity: true } },
      },
    }),
    db.rFQRequest.count({ where }),
  ]);

  return { requests, total, pages: Math.ceil(total / pageSize) };
}

export async function getRFQDetail(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return null;

  return db.rFQRequest.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true, companyName: true, phone: true } },
      items: true,
    },
  });
}

export async function updateRFQStatus(
  id: string,
  status: RFQStatus,
  opts?: { adminNote?: string; quotedTotal?: number }
) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  // Status transition validation
  const allowedTransitions: Record<string, RFQStatus[]> = {
    PENDING: ["REVIEWING", "REJECTED", "EXPIRED"],
    REVIEWING: ["QUOTED", "REJECTED", "EXPIRED"],
    QUOTED: ["ACCEPTED", "REJECTED", "EXPIRED"],
    ACCEPTED: [],
    REJECTED: [],
    EXPIRED: [],
  };

  const rfq = await db.rFQRequest.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!rfq) return { error: "RFQ not found" };

  if (rfq.status === status) return { success: true };

  const allowed = allowedTransitions[rfq.status];
  if (allowed && !allowed.includes(status)) {
    return { error: `Cannot transition from ${rfq.status} to ${status}` };
  }

  // When setting to QUOTED, validate quotedTotal
  if (status === "QUOTED") {
    const quotedTotal = opts?.quotedTotal;
    if (!quotedTotal || quotedTotal <= 0) {
      return { error: "Quoted total must be greater than 0" };
    }
  }

  await db.rFQRequest.update({
    where: { id },
    data: {
      status,
      adminNote: opts?.adminNote,
      quotedTotal: opts?.quotedTotal ?? undefined, // Don't nullify if not provided
    },
  });
  revalidatePath("/admin/rfq");
  revalidatePath(`/admin/rfq/${id}`);
  return { success: true };
}

export async function convertRFQToDraftOrder(rfqId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const orderNumber = generateOrderNumber("ORD");

    const order = await db.$transaction(async (tx) => {
      // Fetch and validate RFQ inside transaction to prevent double conversion
      const rfq = await tx.rFQRequest.findUnique({
        where: { id: rfqId },
        include: { items: true },
      });

      if (!rfq) {
        throw new Error("RFQ not found");
      }

      if (rfq.status !== "QUOTED") {
        throw new Error("Only quoted RFQs can be converted");
      }

      if (!rfq.quotedTotal || Number(rfq.quotedTotal) <= 0) {
        throw new Error("RFQ must have a valid quoted total before conversion");
      }

      if (!rfq.userId) {
        throw new Error("User must be registered to convert RFQ to order");
      }

      // Idempotency check inside transaction
      const existingOrder = await tx.order.findFirst({
        where: { rfqId: rfq.id },
      });

      if (existingOrder) {
        return existingOrder;
      }

      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: rfq.userId!,
          status: "DRAFT",
          paymentStatus: "PENDING",
          total: rfq.quotedTotal || 0, // Using quoted total
          subtotal: rfq.quotedTotal || 0, // Simplified for now
          tax: 0,
          shipping: 0,
          shippingMethodId: null, // User needs to select this
          rfqId: rfq.id, // Link back to RFQ
        },
      });

      // 2. Create Order Items and allocate stock
      const soItems: { variantId: string; quantity: number; unitPrice: number; costPrice: number | null; total: number }[] = [];

      for (const item of rfq.items) {
        if (!item.variantId) continue; // Skip items without resolved variants

        // Fetch variant data including stock for validation
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { price: true, costPrice: true, sku: true, physicalStock: true, allocatedStock: true },
        });

        if (variant) {
          // Validate stock availability before allocating
          const available = variant.physicalStock - variant.allocatedStock;
          if (available < item.quantity) {
            throw new Error(
              `Insufficient stock for ${variant.sku}: available ${available}, requested ${item.quantity}`
            );
          }

          // Use RFQ targetPrice if available, otherwise fall back to variant price
          const unitPrice = item.targetPrice
            ? Number(item.targetPrice)
            : Number(variant.price || 0);
          const itemTotal = unitPrice * item.quantity;

          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              variantId: item.variantId,
              quantity: item.quantity,
              price: unitPrice,
              costPrice: variant.costPrice ? Number(variant.costPrice) : null,
              total: itemTotal,
              name: item.productName,
              sku: item.variantSku || variant.sku || "",
            },
          });

          soItems.push({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice,
            costPrice: variant.costPrice ? Number(variant.costPrice) : null,
            total: itemTotal,
          });

          // 3. Allocate Stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              allocatedStock: { increment: item.quantity },
            },
          });
        }
      }

      // Validate that at least one valid item was created
      if (soItems.length === 0) {
        throw new Error("No valid items to create order");
      }

      // Recalculate total from actual items for consistency
      const calculatedTotal = soItems.reduce((sum, si) => sum + si.total, 0);

      // Update Order total to match actual items
      await tx.order.update({
        where: { id: newOrder.id },
        data: {
          total: calculatedTotal,
          subtotal: calculatedTotal,
        },
      });

      // 3.5. Create linked SalesOrder (same orderNumber for traceability)
      if (soItems.length > 0) {
        await tx.salesOrder.create({
          data: {
            orderNumber,
            customerId: rfq.userId!,
            status: "DRAFT",
            totalAmount: calculatedTotal,
            subtotal: calculatedTotal,
            tax: 0,
            shipping: 0,
            currency: "EUR",
            items: {
              create: soItems.map((si) => ({
                variantId: si.variantId,
                quantity: si.quantity,
                unitPrice: si.unitPrice,
                costPrice: si.costPrice,
                total: si.total,
              })),
            },
          },
        });
      }

      // 4. Update RFQ Status
      await tx.rFQRequest.update({
        where: { id: rfq.id },
        data: { status: "ACCEPTED" },
      });

      return newOrder;
    });

    revalidatePath("/admin/rfq");
    revalidatePath(`/admin/rfq/${rfqId}`);
    return { success: true, orderId: order.id };
  } catch (error) {
    console.error("Failed to convert RFQ to order:", error);
    return { error: "Failed to convert RFQ to order." };
  }
}
