"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";
import { ReturnReason, ReturnStatus } from "@prisma/client";
import { processStockMovement } from "@/lib/inventory";
import { syncProductToIndex } from "@/lib/search/sync";

function generateReturnNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `RET-${ts}`;
}

const createReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.nativeEnum(ReturnReason),
  notes: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      orderItemId: z.string().min(1),
      quantity: z.number().min(1),
      condition: z.enum(["NEW", "USED", "DAMAGED"]).optional(),
    })
  ).min(1),
});

export async function createReturnRequest(
  input: z.infer<typeof createReturnSchema>
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "No autenticado" };

  const parsed = createReturnSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const { orderId, reason, notes, items } = parsed.data;

  const order = await db.order.findUnique({
    where: { id: orderId, userId: session.user.id },
    include: { items: true },
  });
  if (!order) return { error: "Pedido no encontrado" };
  if (order.status === "CANCELLED" || order.status === "RETURNED") {
    return { error: "Este pedido no permite devoluciones" };
  }

  const existing = await db.returnRequest.findFirst({
    where: { orderId, status: { notIn: ["REJECTED", "CLOSED"] } },
  });
  if (existing) return { error: "Ya existe una solicitud de devolución activa para este pedido" };

  for (const item of items) {
    const orderItem = order.items.find(
      (oi) => oi.id === item.orderItemId && oi.variantId === item.variantId
    );
    if (!orderItem || item.quantity > orderItem.quantity) {
      return { error: `Cantidad inválida para el artículo ${item.variantId}` };
    }
  }

  // Fetch variant info for snapshots
  const variantIds = items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, sku: true, product: { select: { content: true, slug: true } } },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const ret = await db.returnRequest.create({
    data: {
      returnNumber: generateReturnNumber(),
      orderId,
      userId: session.user.id,
      reason,
      notes,
      items: {
        create: items.map((i) => {
          const v = variantMap.get(i.variantId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
          const content = v?.product?.content as any;
          const productName = content?.en?.name || content?.es?.name || content?.name || v?.product?.slug || "";
          let productImage: string | undefined;
          if (content?.images && Array.isArray(content.images) && content.images.length > 0) {
            const first = content.images[0];
            productImage = typeof first === "string" ? first : first?.url;
          }
          return {
            variantId: i.variantId,
            orderItemId: i.orderItemId,
            quantity: i.quantity,
            condition: i.condition,
            restockQty: 0,
            name: productName,
            sku: v?.sku || "",
            image: productImage,
          };
        }),
      },
    },
  });

  revalidatePath("/profile");
  revalidatePath("/admin/returns");

  // Send return request received email (non-blocking)
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (user?.email) {
    import("@/lib/email")
      .then(({ sendReturnStatusEmail }) =>
        sendReturnStatusEmail({
          to: user.email,
          customerName: user.name || user.email,
          returnNumber: ret.returnNumber,
          orderNumber: order.orderNumber || orderId.slice(0, 8),
          status: "REQUESTED",
        })
      )
      .catch((e) => console.error("Return status email failed:", e));
  }

  return { success: true, returnId: ret.id, returnNumber: ret.returnNumber };
}

export async function approveReturn(returnId: string, adminNotes?: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const ret = await db.returnRequest.findUnique({
    where: { id: returnId },
    select: { status: true, returnNumber: true, userId: true, order: { select: { orderNumber: true } } },
  });
  if (!ret) return { error: "Return request not found" };
  if (ret.status !== "REQUESTED") {
    return { error: `Cannot approve return in ${ret.status} status. Only REQUESTED returns can be approved.` };
  }

  await db.returnRequest.update({
    where: { id: returnId },
    data: { status: "APPROVED", adminNotes },
  });
  revalidatePath("/admin/returns");

  // Send approval email (non-blocking)
  if (ret.userId) {
    const user = await db.user.findUnique({
      where: { id: ret.userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      import("@/lib/email")
        .then(({ sendReturnStatusEmail }) =>
          sendReturnStatusEmail({
            to: user.email,
            customerName: user.name || user.email,
            returnNumber: ret.returnNumber,
            orderNumber: ret.order?.orderNumber || "",
            status: "APPROVED",
            adminNotes,
          })
        )
        .catch((e) => console.error("Return approval email failed:", e));
    }
  }

  return { success: true };
}

export async function rejectReturn(returnId: string, adminNotes?: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const ret = await db.returnRequest.findUnique({
    where: { id: returnId },
    select: { status: true, returnNumber: true, userId: true, order: { select: { orderNumber: true } } },
  });
  if (!ret) return { error: "Return request not found" };
  if (ret.status !== "REQUESTED" && ret.status !== "APPROVED") {
    return { error: `Cannot reject return in ${ret.status} status. Only REQUESTED or APPROVED returns can be rejected.` };
  }

  await db.returnRequest.update({
    where: { id: returnId },
    data: { status: "REJECTED", adminNotes },
  });
  revalidatePath("/admin/returns");

  // Send rejection email (non-blocking)
  if (ret.userId) {
    const user = await db.user.findUnique({
      where: { id: ret.userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      import("@/lib/email")
        .then(({ sendReturnStatusEmail }) =>
          sendReturnStatusEmail({
            to: user.email,
            customerName: user.name || user.email,
            returnNumber: ret.returnNumber,
            orderNumber: ret.order?.orderNumber || "",
            status: "REJECTED",
            adminNotes,
          })
        )
        .catch((e) => console.error("Return rejection email failed:", e));
    }
  }

  return { success: true };
}

export async function markReturnReceived(
  returnId: string,
  restockData: { itemId: string; restockQty: number }[],
  adminNotes?: string,
  warehouseId?: string
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  // Only validate returnId outside the transaction
  if (!returnId) return { error: "Return ID is required" };

  const restockedVariantIds: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      // Lock the return request row to prevent double-call race condition
      const [retRow] = await tx.$queryRawUnsafe<Array<{ id: string; status: string; warehouseId: string | null }>>(
        `SELECT id, status, "warehouseId" FROM return_requests WHERE id = $1 FOR UPDATE`,
        returnId
      );
      if (!retRow) throw new Error("Return request not found");
      if (retRow.status !== "APPROVED") {
        throw new Error(`Cannot mark return as received in ${retRow.status} status. Only APPROVED returns can be received.`);
      }

      const ret = await tx.returnRequest.findUnique({
        where: { id: returnId },
        include: { items: { include: { variant: true } } },
      });
      if (!ret) throw new Error("Return request not found");

      // Determine warehouse: explicit param > return request stored value > error
      const targetWarehouseId = warehouseId || ret.warehouseId;
      if (!targetWarehouseId) {
        throw new Error("Warehouse is required for return processing. Please select a warehouse.");
      }

      // Update warehouse on return request if provided
      if (warehouseId && warehouseId !== ret.warehouseId) {
        await tx.returnRequest.update({
          where: { id: returnId },
          data: { warehouseId },
        });
      }

      for (const { itemId, restockQty } of restockData) {
        if (restockQty <= 0) continue;
        const item = ret.items.find((i) => i.id === itemId);
        if (!item) continue;

        // Validate restockQty does not exceed remaining returnable quantity
        if (restockQty > item.quantity - item.restockQty) {
          throw new Error(`Restock quantity (${restockQty}) exceeds remaining returnable quantity for item ${item.variantId}`);
        }

        await tx.returnItem.update({
          where: { id: itemId },
          data: { restockQty },
        });

        // Use processStockMovement for proper Bundle component handling
        await processStockMovement(tx, {
          variantId: item.variantId,
          quantity: restockQty,
          type: "RETURN",
          reference: ret.returnNumber,
          note: `Devolución: ${ret.returnNumber}`,
          warehouseId: targetWarehouseId,
        });

        restockedVariantIds.push(item.variantId);
      }

      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: "RECEIVED", adminNotes },
      });

      await tx.order.update({
        where: { id: ret.orderId },
        data: { status: "RETURNED" },
      });

      // Sync linked SalesOrder status
      const order = await tx.order.findUnique({
        where: { id: ret.orderId },
        select: { orderNumber: true },
      });
      if (order) {
        const linkedSO = await tx.salesOrder.findFirst({
          where: { orderNumber: order.orderNumber },
        });
        if (linkedSO && linkedSO.status !== "CANCELLED") {
          await tx.salesOrder.update({
            where: { id: linkedSO.id },
            data: { status: "CANCELLED" },
          });
          // Cancel unpaid invoices
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
    });
  } catch (error) {
    console.error("Error marking return received:", error);
    return { error: error instanceof Error ? error.message : "Failed to mark return as received" };
  }

  // Sync affected products to search index after stock changes
  if (restockedVariantIds.length > 0) {
    const variants = await db.productVariant.findMany({
      where: { id: { in: restockedVariantIds } },
      select: { productId: true },
    });
    const productIds = new Set(variants.map((v) => v.productId));
    productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
  }

  revalidatePath("/admin/returns");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function processRefund(returnId: string, amount: number) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const ret = await db.returnRequest.findUnique({
      where: { id: returnId },
      include: { order: true },
    });

    if (!ret) return { error: "Return request not found" };

    await db.$transaction(async (tx) => {
      // 1. Update return request status
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: "REFUNDED", refundAmount: amount },
      });

      // 2. Update Order paymentStatus to REFUNDED
      if (ret.order) {
        await tx.order.update({
          where: { id: ret.orderId },
          data: { paymentStatus: "REFUNDED" },
        });
      }

      // 3. Find linked SalesOrder → Invoice via orderNumber
      if (ret.order) {
        const linkedSO = await tx.salesOrder.findFirst({
          where: { orderNumber: ret.order.orderNumber },
        });

        if (linkedSO) {
          const invoice = await tx.invoice.findFirst({
            where: { salesOrderId: linkedSO.id },
          });

          if (invoice) {
            // 4. Create negative Payment record for refund
            await tx.payment.create({
              data: {
                invoiceId: invoice.id,
                amount: -amount,
                method: "REFUND",
                note: `Refund for return ${ret.returnNumber}`,
              },
            });

            // 5. Update Invoice paidAmount and status
            const newPaidAmount = Number(invoice.paidAmount) - amount;
            const totalAmount = Number(invoice.totalAmount);

            let newStatus = invoice.status;
            if (newPaidAmount <= 0) {
              newStatus = "CANCELLED";
            } else if (newPaidAmount < totalAmount) {
              newStatus = "PARTIALLY_PAID";
            }

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                paidAmount: Math.max(0, newPaidAmount),
                status: newStatus,
              },
            });
          }
        }
      }
    });

    revalidatePath("/admin/returns");
    revalidatePath("/admin/invoices");

    // Send refund notification email (non-blocking)
    if (ret.userId) {
      const user = await db.user.findUnique({
        where: { id: ret.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        import("@/lib/email")
          .then(({ sendReturnStatusEmail }) =>
            sendReturnStatusEmail({
              to: user.email,
              customerName: user.name || user.email,
              returnNumber: ret.returnNumber,
              orderNumber: ret.order?.orderNumber || "",
              status: "REFUNDED",
              refundAmount: amount,
            })
          )
          .catch((e) => console.error("Refund email failed:", e));
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error processing refund:", error);
    return { error: "Failed to process refund" };
  }
}

export async function closeReturn(returnId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  await db.returnRequest.update({
    where: { id: returnId },
    data: { status: "CLOSED" },
  });
  revalidatePath("/admin/returns");
  return { success: true };
}

export async function getReturnRequests(opts?: {
  status?: ReturnStatus;
  page?: number;
  pageSize?: number;
}) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { items: [], total: 0, page: 1, pageSize: 20 };

  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;

  const where = opts?.status ? { status: opts.status } : {};
  const [items, total] = await Promise.all([
    db.returnRequest.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, companyName: true } },
        order: { select: { orderNumber: true } },
        items: { include: { variant: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.returnRequest.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getReturnRequestById(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  return db.returnRequest.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, companyName: true, taxId: true } },
      order: {
        include: {
          items: { include: { variant: { include: { product: true } } } },
          shippingAddress: true,
        },
      },
      items: {
        include: {
          variant: {
            include: { product: true },
          },
        },
      },
    },
  });
}

export async function getUserReturns(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.id !== userId) return [];

  return db.returnRequest.findMany({
    where: { userId },
    include: {
      order: { select: { orderNumber: true } },
      items: { include: { variant: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderForReturn(orderId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const order = await db.order.findUnique({
    where: { id: orderId, userId: session.user.id },
    include: {
      items: {
        include: {
          variant: {
            include: { product: true },
          },
        },
      },
    },
  });

  if (!order) return null;

  const items = order.items.map((item) => {
    let imageUrl = item.image || "/placeholder-image.jpg";
    if (!item.image) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
        const content = item.variant.product.content as any;
        if (content?.images && Array.isArray(content.images) && content.images.length > 0) {
          const first = content.images[0];
          imageUrl = typeof first === "string" ? first : first?.url || imageUrl;
        }
      } catch {}
    }

    return {
      id: item.id,
      variantId: item.variantId,
      name: item.name,
      sku: item.sku || item.variant.sku || "",
      price: Number(item.price.toString()),
      quantity: item.quantity,
      imageUrl,
    };
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id.slice(0, 8),
    items,
    currency: "EUR",
  };
}

/**
 * Admin-initiated return: bypasses approval flow, sets status directly to RECEIVED.
 * Restocks inventory for RESELLABLE items; records DAMAGED items without restocking.
 */
export async function adminCreateReturn(input: {
  orderId: string;
  warehouseId: string;
  reason: string;
  notes?: string;
  items: {
    orderItemId: string;
    variantId: string;
    quantity: number;
    condition: "RESELLABLE" | "DAMAGED";
  }[];
}) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  // Validate: orderId must exist (can be Order or SalesOrder)
  // Try Order table first
  let order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });

  // If not found in Order, look up SalesOrder and find linked Order
  if (!order) {
    const so = await db.salesOrder.findUnique({
      where: { id: input.orderId },
      select: { orderNumber: true },
    });
    if (so) {
      order = await db.order.findFirst({
        where: { orderNumber: so.orderNumber },
        include: { items: true },
      });
    }
  }

  if (!order) return { error: "Order not found" };

  // Fetch variant info for snapshot fields (name, sku)
  const variantIds = input.items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, sku: true, product: { select: { content: true, slug: true } } },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const restockedVariantIds: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      // 1. Create ReturnRequest with status RECEIVED (skip approval)
      const ret = await tx.returnRequest.create({
        data: {
          returnNumber: generateReturnNumber(),
          orderId: order!.id,
          userId: order!.userId || session.user!.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin form reason may not match enum exactly
          reason: input.reason as any,
          notes: input.notes,
          status: "RECEIVED",
          warehouseId: input.warehouseId,
          items: {
            create: input.items.map((i) => {
              const v = variantMap.get(i.variantId);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
              const content = v?.product?.content as any;
              const productName =
                content?.en?.name || content?.es?.name || v?.product?.slug || "";
              // RESELLABLE → restockQty = quantity; DAMAGED → restockQty = 0
              const restockQty = i.condition === "RESELLABLE" ? i.quantity : 0;
              return {
                variantId: i.variantId,
                orderItemId: i.orderItemId,
                quantity: i.quantity,
                condition: i.condition,
                restockQty,
                name: productName,
                sku: v?.sku || "",
              };
            }),
          },
        },
      });

      // 2. Process inventory based on item condition
      for (const item of input.items) {
        if (item.condition === "RESELLABLE") {
          // Good condition → restock via processStockMovement
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "RETURN",
            reference: ret.returnNumber,
            note: `Admin return: ${ret.returnNumber}`,
            warehouseId: input.warehouseId,
          });
          restockedVariantIds.push(item.variantId);
        } else {
          // Damaged → record actual quantity for audit trail, do not restock
          await tx.inventoryTransaction.create({
            data: {
              variantId: item.variantId,
              warehouseId: input.warehouseId,
              quantity: -item.quantity,
              type: "DAMAGED",
              reference: ret.returnNumber,
              note: `Damaged return item: ${ret.returnNumber}`,
              createdBy: session.user?.id || null,
            },
          });
        }
      }
    });

    // 3. Sync search index for restocked products
    if (restockedVariantIds.length > 0) {
      const affectedVariants = await db.productVariant.findMany({
        where: { id: { in: restockedVariantIds } },
        select: { productId: true },
      });
      const productIds = new Set(affectedVariants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    revalidatePath("/admin/returns");
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    return { success: true };
  } catch (error) {
    console.error("Admin create return error:", error);
    return { error: error instanceof Error ? error.message : "Failed to create return" };
  }
}
