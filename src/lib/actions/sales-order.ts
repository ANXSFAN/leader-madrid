"use server";

import db from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processStockMovement, syncVariantStockFromWarehouses, allocateStock, releaseAllocatedStock, getBundleStock } from "@/lib/inventory";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { createInvoiceFromSO } from "@/lib/actions/invoice";
import { requireRole } from "@/lib/auth-guard";
import { syncProductToIndex } from "@/lib/search/sync";

const salesOrderItemSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
});

const createSOSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  items: z.array(salesOrderItemSchema).min(1, "At least one item is required"),
});

export async function createSalesOrder(data: z.infer<typeof createSOSchema>) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const result = createSOSchema.safeParse(data);

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Invalid sales order data" };
  }

  const { customerId, warehouseId, items } = result.data;

  // Calculate total amount
  const totalAmount = items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );

  try {
    // Fetch costPrice, sku, product info for each variant to snapshot at order time
    const variantIds = items.map((item) => item.variantId);
    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        costPrice: true,
        sku: true,
        physicalStock: true,
        allocatedStock: true,
        productId: true,
        product: { select: { id: true, content: true, slug: true, type: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Check stock availability and generate warnings (does NOT block creation)
    const stockWarnings: string[] = [];
    for (const item of items) {
      const v = variantMap.get(item.variantId);
      if (!v) continue;

      if (v.product.type === "BUNDLE") {
        const available = await getBundleStock(v.product.id);
        if (available < item.quantity) {
          stockWarnings.push(
            `${v.sku}: available ${available}, requested ${item.quantity}`
          );
        }
      } else {
        const available = v.physicalStock - v.allocatedStock;
        if (available < item.quantity) {
          stockWarnings.push(
            `${v.sku}: available ${available}, requested ${item.quantity}`
          );
        }
      }

      // Also check warehouse-level stock
      if (warehouseId) {
        const whStock = await db.warehouseStock.findUnique({
          where: {
            warehouseId_variantId: { warehouseId, variantId: item.variantId },
          },
        });
        const whAvailable = (whStock?.physicalStock ?? 0) - (whStock?.allocatedStock ?? 0);
        if (whAvailable < item.quantity) {
          stockWarnings.push(
            `${v.sku} (warehouse): available ${whAvailable}, requested ${item.quantity}`
          );
        }
      }
    }

    const so = await db.salesOrder.create({
      data: {
        orderNumber: generateOrderNumber("SO"),
        customerId,
        warehouseId,
        totalAmount,
        subtotal: totalAmount,
        tax: 0,
        shipping: 0,
        currency: "EUR",
        exchangeRate: 1.0,
        status: "DRAFT",
        items: {
          create: items.map((item) => {
            const v = variantMap.get(item.variantId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
            const content = v?.product?.content as any;
            const productName = content?.en?.name || content?.es?.name || content?.name || v?.product?.slug || "";
            let productImage: string | undefined;
            if (content?.images && Array.isArray(content.images) && content.images.length > 0) {
              const first = content.images[0];
              productImage = typeof first === "string" ? first : first?.url;
            }
            return {
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: v?.costPrice ? Number(v.costPrice) : null,
              total: item.quantity * item.unitPrice,
              name: productName,
              sku: v?.sku || "",
              image: productImage,
            };
          }),
        },
      },
    });

    revalidatePath("/admin/sales-orders");
    return { success: true, so, stockWarnings };
  } catch (error: unknown) {
    console.error("Error creating sales order:", error);
    return { error: error instanceof Error ? error.message : "Failed to create sales order" };
  }
}

export async function updateSOStatus(
  id: string,
  status: "DRAFT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED"
) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    let soOrderNumber = "";
    let soWarehouseId: string | null = null;
    let soItemsSnapshot: { variantId: string; quantity: number }[] = [];

    // Logic for status change
    await db.$transaction(async (tx) => {
      // Lock the SO row to prevent concurrent status changes
      const [soRow] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; orderNumber: string; warehouseId: string | null }>
      >(
        `SELECT id, status, "orderNumber", "warehouseId" FROM sales_orders WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!soRow) throw new Error("Sales order not found");
      if (soRow.status === status) return; // Already in target status

      soOrderNumber = soRow.orderNumber;
      soWarehouseId = soRow.warehouseId;

      // Fetch items inside transaction
      const soItems = await tx.salesOrderItem.findMany({
        where: { soId: id },
      });
      soItemsSnapshot = soItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

      // Create a compat object for the rest of the function
      const so = {
        status: soRow.status,
        orderNumber: soRow.orderNumber,
        warehouseId: soRow.warehouseId,
        items: soItems,
      };

      // Update SO status
      const updatedSO = await tx.salesOrder.update({
        where: { id },
        data: { status },
      });

      // Synchronize status with Web Order (if linked by orderNumber)
      if (updatedSO.orderNumber.startsWith("ORD-")) {
        const webOrder = await tx.order.findFirst({
          where: { orderNumber: updatedSO.orderNumber },
        });

        if (webOrder) {
          let webStatus: OrderStatus = webOrder.status;
          switch (status) {
            case "CONFIRMED":
              webStatus = "CONFIRMED";
              break;
            case "SHIPPED":
              webStatus = "SHIPPED";
              break;
            case "DELIVERED":
              webStatus = "DELIVERED";
              break;
            case "CANCELLED":
              webStatus = "CANCELLED";
              break;
          }

          if (webStatus !== webOrder.status) {
            await tx.order.update({
              where: { id: webOrder.id },
              data: { status: webStatus },
            });
          }
        }
      }

      const releaseStock = async (variantId: string, quantity: number) => {
        await releaseAllocatedStock(tx, {
          variantId,
          quantity,
          warehouseId: so.warehouseId,
        });
      };

      // If status becomes CONFIRMED, allocate stock to prevent overselling
      // Web orders (ORD- prefix) already allocated stock in createWebOrder, skip to avoid double allocation
      if (status === "CONFIRMED" && so.status === "DRAFT") {
        if (!so.orderNumber.startsWith("ORD-")) {
          // Validate and allocate stock (warehouse + global level)
          for (const item of so.items) {
            await allocateStock(tx, {
              variantId: item.variantId,
              quantity: item.quantity,
              warehouseId: so.warehouseId,
            });
          }
        }
      }

      // If status becomes SHIPPED, update inventory
      if (status === "SHIPPED" && so.status !== "SHIPPED") {
        if (!so.warehouseId) {
          throw new Error("Cannot ship SO: no warehouse assigned.");
        }
        for (const item of so.items) {
          await releaseStock(item.variantId, item.quantity);
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: -item.quantity,
            type: "SALE_ORDER",
            reference: so.orderNumber,
            note: `Shipped for SO ${so.orderNumber}`,
            warehouseId: so.warehouseId,
          });
        }
      }

      if (
        status === "CANCELLED" &&
        so.status !== "SHIPPED" &&
        so.status !== "DELIVERED"
      ) {
        for (const item of so.items) {
          await releaseStock(item.variantId, item.quantity);
        }
      }

      // If cancelling a SHIPPED or DELIVERED order, revert stock
      if (
        status === "CANCELLED" &&
        (so.status === "SHIPPED" || so.status === "DELIVERED")
      ) {
        if (!so.warehouseId) {
          throw new Error("Cannot reverse stock for cancelled SO: no warehouse assigned.");
        }
        for (const item of so.items) {
          await releaseStock(item.variantId, item.quantity);
          await processStockMovement(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            type: "SALE_ORDER",
            reference: so.orderNumber,
            note: `Stock reversal for cancelled SO ${so.orderNumber}`,
            warehouseId: so.warehouseId,
          });
        }
      }

      // Cascade cancel unpaid invoices when SO is cancelled
      if (status === "CANCELLED") {
        const invoices = await tx.invoice.findMany({
          where: { salesOrderId: id },
        });
        for (const invoice of invoices) {
          if (invoice.status !== "PAID" && invoice.status !== "CANCELLED") {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "CANCELLED" },
            });
          }
        }
      }
    });

    // Auto-create invoice if status is valid
    if (["CONFIRMED", "SHIPPED", "DELIVERED"].includes(status)) {
      try {
        // Re-verify SO is still in the expected status (guard against concurrent cancellation)
        const currentSO = await db.salesOrder.findUnique({
          where: { id },
          select: { status: true },
        });
        if (currentSO && currentSO.status !== "CANCELLED") {
          let invoiceStatus: "DRAFT" | "SENT" = "DRAFT";
          if (status === "SHIPPED" || status === "DELIVERED") {
            invoiceStatus = "SENT";
          }
          await createInvoiceFromSO(id, invoiceStatus);
        }
      } catch (e) {
        console.error("Failed to auto-create invoice:", e);
      }
    }

    revalidatePath("/admin/sales-orders");
    revalidatePath(`/admin/sales-orders/${id}`);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");

    // Sync affected products to search index after stock changes
    if ((status === "SHIPPED" || status === "CANCELLED") && soItemsSnapshot.length > 0) {
      const variantIds = soItemsSnapshot.map((item) => item.variantId);
      const variants = await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true },
      });
      const productIds = new Set(variants.map((v) => v.productId));
      productIds.forEach((pid) => syncProductToIndex(pid).catch(() => {}));
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating SO status:", error);
    return { error: error instanceof Error ? error.message : "Failed to update status" };
  }
}

export async function getSalesOrders() {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];
  try {
    const sos = await db.salesOrder.findMany({
      include: {
        customer: true,
        warehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return sos;
  } catch (error) {
    console.error("Error fetching SOs:", error);
    return [];
  }
}

export async function getSalesOrder(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return null;
  try {
    const so = await db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            addresses: true,
          },
        },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        shippingMethod: true,
        invoices: true,
      },
    });
    return so;
  } catch (error) {
    console.error("Error fetching SO:", error);
    return null;
  }
}

export async function getCustomers() {
  try {
    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
      },
    });
    return users;
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}
