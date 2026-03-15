"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { requireRole } from "@/lib/auth-guard";

// --- Zod Schemas ---

const customsItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  hsCode: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  totalValue: z.number().min(0),
  weight: z.number().optional(),
  countryOfOrigin: z.string().optional(),
});

const createCustomsSchema = z.object({
  type: z.enum(["IMPORT", "EXPORT"]),
  purchaseOrderId: z.string().optional(),
  salesOrderId: z.string().optional(),
  customsOffice: z.string().optional(),
  entryPort: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  destinationCountry: z.string().optional(),
  declaredValue: z.number().min(0),
  currency: z.string().default("EUR"),
  dutyRate: z.number().optional(),
  dutyAmount: z.number().optional(),
  vatAmount: z.number().optional(),
  otherCharges: z.number().optional(),
  totalCost: z.number().optional(),
  trackingNumber: z.string().optional(),
  shippingMethod: z.enum(["SEA", "AIR", "ROAD", "RAIL"]).optional(),
  estimatedArrival: z.string().optional(),
  brokerName: z.string().optional(),
  brokerContact: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(customsItemSchema).min(1, "At least one item is required"),
});

const updateCustomsSchema = createCustomsSchema.partial().omit({ items: true }).extend({
  items: z.array(customsItemSchema).min(1).optional(),
});

// --- Server Actions ---

export async function getCustomsDeclarations(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.status && filters.status !== "ALL") {
      where.status = filters.status;
    }
    if (filters?.type && filters.type !== "ALL") {
      where.type = filters.type;
    }
    if (filters?.search) {
      where.OR = [
        { declarationNumber: { contains: filters.search, mode: "insensitive" } },
        { brokerName: { contains: filters.search, mode: "insensitive" } },
        { trackingNumber: { contains: filters.search, mode: "insensitive" } },
        { entryPort: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const declarations = await db.customsDeclaration.findMany({
      where,
      include: {
        purchaseOrder: { select: { poNumber: true } },
        salesOrder: { select: { orderNumber: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return declarations;
  } catch (error) {
    console.error("Error fetching customs declarations:", error);
    return [];
  }
}

export async function getCustomsDeclaration(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  try {
    const declaration = await db.customsDeclaration.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: {
              include: {
                variant: {
                  include: { product: true },
                },
              },
            },
          },
        },
        salesOrder: {
          include: {
            customer: true,
            items: {
              include: {
                variant: {
                  include: { product: true },
                },
              },
            },
          },
        },
        items: true,
      },
    });
    return declaration;
  } catch (error) {
    console.error("Error fetching customs declaration:", error);
    return null;
  }
}

export async function createCustomsDeclaration(
  data: z.infer<typeof createCustomsSchema>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const result = createCustomsSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Invalid customs declaration data" };
  }

  const { items, estimatedArrival, ...rest } = result.data;

  try {
    const declaration = await db.customsDeclaration.create({
      data: {
        declarationNumber: generateOrderNumber("CD"),
        ...rest,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        status: "DRAFT",
        items: {
          create: items.map((item) => ({
            productName: item.productName,
            sku: item.sku,
            hsCode: item.hsCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalValue: item.totalValue,
            weight: item.weight,
            countryOfOrigin: item.countryOfOrigin,
          })),
        },
      },
    });

    revalidatePath("/admin/customs");
    return { success: true, declaration };
  } catch (error: unknown) {
    console.error("Error creating customs declaration:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create customs declaration",
    };
  }
}

export async function updateCustomsDeclaration(
  id: string,
  data: z.infer<typeof updateCustomsSchema>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const existing = await db.customsDeclaration.findUnique({
      where: { id },
    });
    if (!existing) return { error: "Declaration not found" };
    if (existing.status !== "DRAFT") {
      return { error: "Only DRAFT declarations can be edited" };
    }

    const result = updateCustomsSchema.safeParse(data);
    if (!result.success) {
      console.error("Validation error:", result.error);
      return { error: "Invalid data" };
    }

    const { items, estimatedArrival, ...rest } = result.data;

    await db.$transaction(async (tx) => {
      await tx.customsDeclaration.update({
        where: { id },
        data: {
          ...rest,
          estimatedArrival: estimatedArrival
            ? new Date(estimatedArrival)
            : undefined,
        },
      });

      if (items) {
        await tx.customsDeclarationItem.deleteMany({
          where: { declarationId: id },
        });
        await tx.customsDeclarationItem.createMany({
          data: items.map((item) => ({
            declarationId: id,
            productName: item.productName,
            sku: item.sku,
            hsCode: item.hsCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalValue: item.totalValue,
            weight: item.weight,
            countryOfOrigin: item.countryOfOrigin,
          })),
        });
      }
    });

    revalidatePath("/admin/customs");
    revalidatePath(`/admin/customs/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating customs declaration:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update customs declaration",
    };
  }
}

export async function updateCustomsStatus(
  id: string,
  status: "DRAFT" | "SUBMITTED" | "INSPECTING" | "CLEARED" | "HELD" | "RELEASED"
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const existing = await db.customsDeclaration.findUnique({
      where: { id },
    });
    if (!existing) return { error: "Declaration not found" };
    if (existing.status === status) return { success: true };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { status };

    if (status === "SUBMITTED" && !existing.submittedAt) {
      updateData.submittedAt = new Date();
    }
    if (status === "CLEARED" && !existing.clearedAt) {
      updateData.clearedAt = new Date();
    }
    if (status === "RELEASED" && !existing.clearedAt) {
      updateData.clearedAt = new Date();
    }

    await db.customsDeclaration.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/customs");
    revalidatePath(`/admin/customs/${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating customs status:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update status",
    };
  }
}

export async function deleteCustomsDeclaration(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const existing = await db.customsDeclaration.findUnique({
      where: { id },
    });
    if (!existing) return { error: "Declaration not found" };
    if (existing.status !== "DRAFT") {
      return { error: "Only DRAFT declarations can be deleted" };
    }

    await db.customsDeclaration.delete({ where: { id } });

    revalidatePath("/admin/customs");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting customs declaration:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete customs declaration",
    };
  }
}

// Helper: get PO items for auto-fill
export async function getPurchaseOrderForCustoms(poId: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        items: {
          include: {
            variant: {
              include: {
                product: { select: { hsCode: true, content: true } },
              },
            },
          },
        },
      },
    });
    return po;
  } catch (error) {
    console.error("Error fetching PO for customs:", error);
    return null;
  }
}

// Helper: get available POs and SOs for linking
export async function getOrdersForCustomsLinking() {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER", "SALES_REP"]);
  if (!session) return { purchaseOrders: [], salesOrders: [] };

  try {
    const [purchaseOrders, salesOrders] = await Promise.all([
      db.purchaseOrder.findMany({
        select: { id: true, poNumber: true, supplier: { select: { name: true } }, status: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.salesOrder.findMany({
        select: { id: true, orderNumber: true, customer: { select: { name: true, companyName: true } }, status: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return { purchaseOrders, salesOrders };
  } catch (error) {
    console.error("Error fetching orders for customs:", error);
    return { purchaseOrders: [], salesOrders: [] };
  }
}
