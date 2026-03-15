"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateSOStatus } from "@/lib/actions/sales-order";
import { requireRole } from "@/lib/auth-guard";
import { sendShipmentNotificationEmail } from "@/lib/email";

const shippingMethodSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be non-negative"),
  estimatedDays: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type ShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDays: number | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapShippingStatusToOrderStatus(shippingStatus?: string) {
  switch (shippingStatus) {
    case "PENDING":
      return "PENDING";
    case "PROCESSING":
      return "PROCESSING";
    case "SHIPPED":
    case "IN_TRANSIT":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    case "RETURNED":
      return "RETURNED";
    case "FAILED":
      return "PROCESSING";
    default:
      return undefined;
  }
}

export async function getShippingMethods() {
  try {
    const methods = await db.shippingMethod.findMany({
      orderBy: { isDefault: "desc" },
    });
    return methods.map((m) => ({
      ...m,
      price: Number(m.price),
    }));
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return [];
  }
}

export async function getShippingMethodById(id: string) {
  try {
    const method = await db.shippingMethod.findUnique({
      where: { id },
    });
    if (!method) return null;
    return { ...method, price: Number(method.price) };
  } catch (error) {
    console.error("Error fetching shipping method:", error);
    return null;
  }
}

export async function getActiveShippingMethods() {
  try {
    const methods = await db.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { price: "asc" }],
    });
    return methods.map((m) => ({
      ...m,
      price: Number(m.price),
    }));
  } catch (error) {
    console.error("Error fetching active shipping methods:", error);
    return [];
  }
}

export async function createShippingMethod(
  data: z.infer<typeof shippingMethodSchema>
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const result = shippingMethodSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  try {
    if (result.data.isDefault) {
      await db.shippingMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const method = await db.shippingMethod.create({
      data: {
        name: result.data.name,
        description: result.data.description,
        price: result.data.price,
        estimatedDays: result.data.estimatedDays,
        isActive: result.data.isActive,
        isDefault: result.data.isDefault,
      },
    });

    revalidatePath("/admin/shipping");
    revalidatePath("/admin/settings");

    return {
      success: true,
      method: { ...method, price: Number(method.price) },
    };
  } catch (error) {
    console.error("Error creating shipping method:", error);
    return { error: "Failed to create shipping method" };
  }
}

export async function updateShippingMethod(
  data: z.infer<typeof shippingMethodSchema>
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const result = shippingMethodSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  if (!result.data.id) {
    return { error: "Shipping method ID is required" };
  }

  try {
    if (result.data.isDefault) {
      await db.shippingMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const method = await db.shippingMethod.update({
      where: { id: result.data.id },
      data: {
        name: result.data.name,
        description: result.data.description,
        price: result.data.price,
        estimatedDays: result.data.estimatedDays,
        isActive: result.data.isActive,
        isDefault: result.data.isDefault,
      },
    });

    revalidatePath("/admin/shipping");
    revalidatePath("/admin/settings");

    return {
      success: true,
      method: { ...method, price: Number(method.price) },
    };
  } catch (error) {
    console.error("Error updating shipping method:", error);
    return { error: "Failed to update shipping method" };
  }
}

export async function deleteShippingMethod(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    // Check for references in Orders and SalesOrders before deleting
    const [orderRefs, soRefs] = await Promise.all([
      db.order.count({ where: { shippingMethodId: id } }),
      db.salesOrder.count({ where: { shippingMethodId: id } }),
    ]);
    if (orderRefs + soRefs > 0) {
      return {
        error: `Cannot delete shipping method: it is referenced by ${orderRefs} order(s) and ${soRefs} sales order(s). Deactivate it instead.`,
      };
    }

    await db.shippingMethod.delete({
      where: { id },
    });

    revalidatePath("/admin/shipping");
    revalidatePath("/admin/settings");

    return { success: true };
  } catch (error) {
    console.error("Error deleting shipping method:", error);
    return { error: "Failed to delete shipping method" };
  }
}

export async function updateOrderShipping(
  orderId: string,
  data: {
    shippingMethodId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    shippingStatus?: string;
  }
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    const updateData: Prisma.OrderUncheckedUpdateInput = {};

    if (data.shippingMethodId !== undefined) {
      updateData.shippingMethodId = data.shippingMethodId;
    }
    if (data.trackingNumber !== undefined) {
      updateData.trackingNumber = data.trackingNumber;
    }
    if (data.trackingUrl !== undefined) {
      updateData.trackingUrl = data.trackingUrl;
    }
    if (data.shippingStatus !== undefined) {
      updateData.shippingStatus = data.shippingStatus as Prisma.EnumShippingStatusFieldUpdateOperationsInput["set"];
      const mappedStatus = mapShippingStatusToOrderStatus(data.shippingStatus);
      if (mappedStatus) {
        updateData.status = mappedStatus;
      }

      if (data.shippingStatus === "SHIPPED") {
        updateData.shippedAt = new Date();
      } else if (data.shippingStatus === "DELIVERED") {
        updateData.deliveredAt = new Date();
      }
    }

    const order = await db.order.update({
      where: { id: orderId },
      data: updateData,
      include: { shippingMethod: true, user: true },
    });

    // Send email notification when shipping status changes to SHIPPED or DELIVERED
    if (
      data.shippingStatus === "SHIPPED" || data.shippingStatus === "DELIVERED"
    ) {
      const userEmail = order.user?.email;
      const userName = order.user?.name || order.user?.email || "Cliente";
      if (userEmail) {
        sendShipmentNotificationEmail({
          to: userEmail,
          customerName: userName,
          orderNumber: order.orderNumber,
          status: data.shippingStatus as "SHIPPED" | "DELIVERED",
          trackingNumber: order.trackingNumber ?? undefined,
          trackingUrl: order.trackingUrl ?? undefined,
        }).catch((err) => console.error("[shipping] Failed to send notification email:", err));
      }
    }

    if (order.orderNumber.startsWith("ORD-")) {
      const so = await db.salesOrder.findFirst({
        where: { orderNumber: order.orderNumber },
      });

      if (so) {
        await db.salesOrder.update({
          where: { id: so.id },
          data: {
            shippingMethodId: order.shippingMethodId,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            shippingStatus: order.shippingStatus,
            shippedAt: order.shippedAt,
            deliveredAt: order.deliveredAt,
          },
        });

        if (order.status === "SHIPPED") {
          await updateSOStatus(so.id, "SHIPPED");
        } else if (order.status === "DELIVERED") {
          await updateSOStatus(so.id, "DELIVERED");
        }
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/profile/orders");
    revalidatePath(`/profile/orders/${orderId}`);

    return { success: true, order };
  } catch (error) {
    console.error("Error updating order shipping:", error);
    return { error: "Failed to update shipping" };
  }
}

export async function updateSOShipping(
  soId: string,
  data: {
    shippingMethodId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    shippingStatus?: string; // cast to ShippingStatus below
  }
)
 {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    const updateData: Prisma.SalesOrderUncheckedUpdateInput = {};

    if (data.shippingMethodId !== undefined) {
      updateData.shippingMethodId = data.shippingMethodId;
    }
    if (data.trackingNumber !== undefined) {
      updateData.trackingNumber = data.trackingNumber;
    }
    if (data.trackingUrl !== undefined) {
      updateData.trackingUrl = data.trackingUrl;
    }
    if (data.shippingStatus !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- string from client, validated by Prisma enum
      updateData.shippingStatus = data.shippingStatus as any;

      if (data.shippingStatus === "SHIPPED") {
        updateData.shippedAt = new Date();
      } else if (data.shippingStatus === "DELIVERED") {
        updateData.deliveredAt = new Date();
      }
    }

    const so = await db.salesOrder.update({
      where: { id: soId },
      data: updateData,
      include: { shippingMethod: true },
    });

    if (so.orderNumber.startsWith("ORD-")) {
      const mappedStatus = mapShippingStatusToOrderStatus(so.shippingStatus);
      const orderUpdateData: Prisma.OrderUncheckedUpdateInput = {
        shippingMethodId: so.shippingMethodId,
        trackingNumber: so.trackingNumber,
        trackingUrl: so.trackingUrl,
        shippingStatus: so.shippingStatus,
        shippedAt: so.shippedAt,
        deliveredAt: so.deliveredAt,
      };

      if (mappedStatus) {
        orderUpdateData.status = mappedStatus;
      }

      await db.order.update({
        where: { orderNumber: so.orderNumber },
        data: orderUpdateData,
      });
    }

    // Trigger full SO status transition (inventory handling, invoice creation, etc.)
    // This runs for ALL SOs (not just ORD- linked ones) because standalone SOs also need stock processing
    if (data.shippingStatus === "SHIPPED") {
      await updateSOStatus(so.id, "SHIPPED");
    } else if (data.shippingStatus === "DELIVERED") {
      await updateSOStatus(so.id, "DELIVERED");
    }

    revalidatePath("/admin/sales-orders");
    revalidatePath(`/admin/sales-orders/${soId}`);

    return { success: true, so };
  } catch (error) {
    console.error("Error updating sales order shipping:", error);
    return { error: "Failed to update shipping" };
  }
}
