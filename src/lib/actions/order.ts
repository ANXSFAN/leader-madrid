"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { OrderService } from "@/lib/services/order-service";
import db from "@/lib/db";
import { createPaymentTransaction } from "@/lib/services/payment-service";
import { requireRole } from "@/lib/auth-guard";
import { processStockMovement, releaseAllocatedStock } from "@/lib/inventory";
import { getDefaultWarehouseId } from "@/lib/actions/warehouse";

const orderItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().min(1),
  price: z.number().min(0),
});

const shippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(2),
  phone: z.string().min(1),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  totalAmount: z.number().min(0),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.string().min(1),
  poNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  buyerCountry: z.string().optional(),
  shippingMethodId: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.number().optional(),
});

export async function createOrder(input: z.infer<typeof createOrderSchema>) {
  const result = createOrderSchema.safeParse(input);

  if (!result.success) {
    return {
      error: "Datos de pedido inválidos. Por favor verifique la información.",
    };
  }

  const {
    items,
    shippingAddress,
    paymentMethod,
    poNumber,
    vatNumber,
    buyerCountry,
    shippingMethodId,
    currency: orderCurrency,
    exchangeRate: orderExchangeRate,
  } = result.data;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "Debes iniciar sesión para realizar un pedido." };
  }

  const userId = session.user.id;
  const dbUser = await db.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    return {
      error: "Usuario no encontrado. Por favor, inicie sesión nuevamente.",
    };
  }

  // Credit check (only if credit_management module is enabled)
  try {
    const { getModuleToggles } = await import("@/lib/actions/config");
    const toggles = await getModuleToggles();
    if (toggles.credit_management) {
      const { checkCreditAvailability } = await import("@/lib/actions/credit");
      const creditCheck = await checkCreditAvailability(userId, result.data.totalAmount);
      if (!creditCheck.allowed) {
        return { error: creditCheck.reason };
      }
    }
  } catch (e) {
    // Don't block orders if credit check fails
    console.error("Credit check error:", e);
  }

  try {
    const serviceResult = await OrderService.createWebOrder({
      userId,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      shippingAddress,
      paymentMethod,
      poNumber,
      vatNumber: vatNumber || undefined,
      buyerCountry: buyerCountry || shippingAddress.country,
      shippingMethodId: shippingMethodId || undefined,
      currency: orderCurrency || "EUR",
      exchangeRate: orderExchangeRate || 1,
    });

    try {
      await createPaymentTransaction(serviceResult.orderId);
    } catch (paymentError) {
      console.error("Payment transaction init failed:", paymentError);
    }

    // Charge customer balance for credit terms (use server-calculated total)
    try {
      const { getModuleToggles } = await import("@/lib/actions/config");
      const toggles = await getModuleToggles();
      if (toggles.credit_management && dbUser.paymentTermsDays > 0) {
        const createdOrder = await db.order.findUnique({
          where: { id: serviceResult.orderId },
          select: { total: true },
        });
        const serverTotal = createdOrder ? Number(createdOrder.total) : result.data.totalAmount;
        const { chargeCustomerBalance } = await import("@/lib/actions/credit");
        await chargeCustomerBalance(userId, serverTotal);
      }
    } catch (e) {
      console.error("Credit charge error:", e);
    }

    revalidatePath("/admin/orders");
    revalidatePath("/cart");
    revalidatePath("/profile");

    try {
      const { sendOrderConfirmationEmail } = await import("@/lib/email");
      const orderForEmail = await db.order.findUnique({
        where: { id: serviceResult.orderId },
        include: {
          items: {
            select: { variantId: true, quantity: true, price: true },
          },
          shippingAddress: true,
        },
      });

      const emailItems = orderForEmail?.items?.length
        ? orderForEmail.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            price: Number(item.price),
          }))
        : items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          }));

      await sendOrderConfirmationEmail({
        to: dbUser.email,
        customerName: dbUser.name || dbUser.email,
        orderNumber: serviceResult.orderNumber,
        orderId: serviceResult.orderId,
        items: emailItems,
        total: Number(orderForEmail?.total ?? result.data.totalAmount),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- address shape varies between DB and form
        shippingAddress: (orderForEmail?.shippingAddress ?? shippingAddress) as any,
        paymentMethod: orderForEmail?.paymentMethod ?? paymentMethod,
        isB2B: dbUser.b2bStatus === "APPROVED",
        vatNumber: orderForEmail?.buyerVatNumber ?? vatNumber,
        isReverseCharge: orderForEmail?.isReverseCharge ?? false,
      });
    } catch (emailErr) {
      console.error("Order email failed (non-blocking):", emailErr);
    }

    return { success: true, orderId: serviceResult.orderId };
  } catch (error: unknown) {
    console.error("Error creating order:", error);
    return { error: error instanceof Error ? error.message : "Error al procesar el pedido." };
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  // Status transition validation
  const allowedTransitions: Record<string, OrderStatus[]> = {
    DRAFT: ["PENDING", "CONFIRMED", "CANCELLED"],
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "RETURNED"],
    DELIVERED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
  };

  try {
    // TODO: 未来多仓发货（就近仓库）需要在此扩展仓库选择逻辑
    const defaultWarehouseId = await getDefaultWarehouseId();

    let orderNumber = "";
    let orderItems: { variantId: string; quantity: number }[] = [];
    let previousStatus = "";

    await db.$transaction(async (tx) => {
      // Lock the order row to prevent concurrent status changes
      const [orderRow] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; orderNumber: string; paymentStatus: string }>
      >(
        `SELECT id, status, "orderNumber", "paymentStatus" FROM orders WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!orderRow) throw new Error("Order not found");
      if (orderRow.status === status) return; // Already in target status

      const allowed = allowedTransitions[orderRow.status as OrderStatus];
      if (allowed && !allowed.includes(status)) {
        throw new Error(`Cannot transition from ${orderRow.status} to ${status}`);
      }

      orderNumber = orderRow.orderNumber;
      previousStatus = orderRow.status;

      // Fetch items inside transaction
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
      });
      orderItems = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

      // Update Order status (with refund if cancelling a paid order)
      const updateData: { status: OrderStatus; paymentStatus?: PaymentStatus } = { status };
      if (status === "CANCELLED" && orderRow.paymentStatus === "PAID") {
        updateData.paymentStatus = "REFUNDED";
      }
      await tx.order.update({ where: { id }, data: updateData });

      // Release allocatedStock on cancellation (only if not yet shipped/delivered)
      if (
        status === "CANCELLED" &&
        orderRow.status !== "SHIPPED" &&
        orderRow.status !== "DELIVERED" &&
        orderRow.status !== "CANCELLED"
      ) {
        for (const item of items) {
          await releaseAllocatedStock(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            warehouseId: defaultWarehouseId,
          });
        }
      }

      // Restore physicalStock when cancelling a SHIPPED or DELIVERED order
      if (
        status === "CANCELLED" &&
        (orderRow.status === "SHIPPED" || orderRow.status === "DELIVERED")
      ) {
        for (const item of items) {
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "SALE_ORDER",
            reference: orderRow.orderNumber,
            note: `Stock reversal for cancelled Order ${orderRow.orderNumber}`,
            warehouseId: defaultWarehouseId,
          });
        }
      }

      // Sync linked SalesOrder status via orderNumber
      const linkedSO = await tx.salesOrder.findFirst({
        where: { orderNumber: orderRow.orderNumber },
      });

      if (linkedSO) {
        let soStatus: "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | null = null;
        if (status === "CONFIRMED") soStatus = "CONFIRMED";
        if (status === "SHIPPED") soStatus = "SHIPPED";
        if (status === "DELIVERED") soStatus = "DELIVERED";
        if (status === "CANCELLED") soStatus = "CANCELLED";

        if (soStatus && linkedSO.status !== soStatus) {
          // For CANCELLED, use updateSOStatus logic path for full stock release
          // But we're inside a transaction, so we handle it inline
          await tx.salesOrder.update({
            where: { id: linkedSO.id },
            data: { status: soStatus },
          });

          // If shipping the SO, handle inventory (release allocated, deduct physical)
          if (soStatus === "SHIPPED" && linkedSO.status !== "SHIPPED" && linkedSO.status !== "DELIVERED") {
            const soWithItems = await tx.salesOrder.findUnique({
              where: { id: linkedSO.id },
              include: { items: true },
            });
            if (soWithItems) {
              for (const item of soWithItems.items) {
                // Release allocated stock
                await releaseAllocatedStock(tx, {
                  variantId: item.variantId,
                  quantity: item.quantity,
                  warehouseId: defaultWarehouseId,
                });
                // Deduct physical stock
                await processStockMovement(tx, {
                  variantId: item.variantId,
                  quantity: -item.quantity,
                  type: "SALE_ORDER",
                  reference: linkedSO.orderNumber,
                  note: `Shipped for SO ${linkedSO.orderNumber} (synced from Order)`,
                  warehouseId: defaultWarehouseId,
                });
              }
            }
          }

          // If cancelling the SO (and it was CONFIRMED+), release SO allocatedStock too
          if (
            soStatus === "CANCELLED" &&
            linkedSO.status !== "SHIPPED" &&
            linkedSO.status !== "DELIVERED" &&
            linkedSO.status !== "CANCELLED"
          ) {
            // allocatedStock already released above via Order items (same variants)
            // No double release needed since Order and SO share the same allocatedStock pool
          }

          // Cascade cancel unpaid invoices linked to this SO
          if (soStatus === "CANCELLED") {
            const invoices = await tx.invoice.findMany({
              where: { salesOrderId: linkedSO.id },
            });
            for (const inv of invoices) {
              if (inv.status !== "PAID" && inv.status !== "CANCELLED") {
                await tx.invoice.update({
                  where: { id: inv.id },
                  data: { status: "CANCELLED" },
                });
              }
            }
          }
        }
      }
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/sales-orders");

    // Sync affected products to search index
    if (status === "CANCELLED" && orderItems.length > 0) {
      const variantIds = orderItems.map((item) => item.variantId);
      const variants = await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true },
      });
      const { syncProductToIndex } = await import("@/lib/search/sync");
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { error: "Failed to update order status" };
  }
}

export async function bulkUpdateOrderStatus(ids: string[], status: OrderStatus) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };
  if (ids.length === 0) return { error: "No orders selected" };

  const results = [];
  for (const id of ids) {
    const result = await updateOrderStatus(id, status);
    results.push(result);
  }

  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    return { error: `Failed to update ${errors.length}/${ids.length} orders` };
  }

  revalidatePath("/admin/orders");
  return { success: true, count: ids.length };
}

export async function updateOrderNotes(orderId: string, notes: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.order.update({
      where: { id: orderId },
      data: { internalNotes: notes || null },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating order notes:", error);
    return { error: "Failed to update notes" };
  }
}

export async function bulkCreateShipments(
  orderIds: string[],
  shipmentMethodId: number,
  weight: string
) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };
  if (orderIds.length === 0) return { error: "No orders selected" };

  const { createShipmentAction } = await import("@/lib/actions/logistics");
  const { updateOrderShipping } = await import("@/lib/actions/shipping");

  const results: { orderId: string; success: boolean; error?: string }[] = [];

  for (const orderId of orderIds) {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { shippingAddress: true, user: true },
      });

      if (!order) {
        results.push({ orderId, success: false, error: "Order not found" });
        continue;
      }

      const addr = order.shippingAddress;
      if (!addr) {
        results.push({ orderId, success: false, error: "No shipping address" });
        continue;
      }

      const shipmentResult = await createShipmentAction({
        name: `${addr.firstName} ${addr.lastName}`,
        address: addr.street,
        house_number: "",
        city: addr.city,
        postal_code: addr.zipCode,
        country: addr.country,
        telephone: addr.phone || "",
        email: order.user?.email || "",
        weight,
        shipment: { id: shipmentMethodId },
      });

      if (!shipmentResult.success) {
        results.push({ orderId, success: false, error: shipmentResult.error });
        continue;
      }

      const parcel = shipmentResult.parcel;
      await updateOrderShipping(orderId, {
        trackingNumber: parcel.tracking_number,
        trackingUrl: parcel.tracking_url,
        shippingStatus: "SHIPPED",
      });

      results.push({ orderId, success: true });
    } catch (err: unknown) {
      results.push({ orderId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  revalidatePath("/admin/orders");
  return { success: true, successCount, failCount, results };
}
