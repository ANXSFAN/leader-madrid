"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { syncVariantStockFromWarehouses } from "@/lib/inventory";

// --- Default Warehouse Helper ---

export async function getDefaultWarehouseId(): Promise<string> {
  const warehouse = await db.warehouse.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  if (!warehouse) {
    throw new Error("No default warehouse configured. Please set a default warehouse in warehouse settings.");
  }
  return warehouse.id;
}

// --- Schemas ---

const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9\-]+$/, "Code must be uppercase alphanumeric with dashes"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const stockTransferItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const createStockTransferSchema = z.object({
  fromWarehouseId: z.string().min(1, "Source warehouse is required"),
  toWarehouseId: z.string().min(1, "Destination warehouse is required"),
  note: z.string().optional(),
  items: z.array(stockTransferItemSchema).min(1, "At least one item is required"),
});

// --- Warehouse CRUD ---

export async function getWarehouses() {
  return await db.warehouse.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { stockEntries: true },
      },
    },
  });
}

export async function getWarehouse(id: string) {
  return await db.warehouse.findUnique({
    where: { id },
    include: {
      _count: {
        select: { stockEntries: true, outTransfers: true, inTransfers: true },
      },
    },
  });
}

export async function createWarehouse(data: z.infer<typeof warehouseSchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = warehouseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    // If setting as default, unset any existing default
    if (parsed.data.isDefault) {
      await db.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await db.warehouse.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        isDefault: parsed.data.isDefault ?? false,
        isActive: parsed.data.isActive ?? true,
      },
    });

    revalidatePath("/admin/warehouses");
    return { success: true, warehouse };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A warehouse with this code already exists" };
    }
    console.error("Error creating warehouse:", error);
    return { error: "Failed to create warehouse" };
  }
}

export async function updateWarehouse(id: string, data: z.infer<typeof warehouseSchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = warehouseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    // If setting as default, unset any existing default
    if (parsed.data.isDefault) {
      await db.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        country: parsed.data.country || null,
        isDefault: parsed.data.isDefault ?? false,
        isActive: parsed.data.isActive ?? true,
      },
    });

    revalidatePath("/admin/warehouses");
    revalidatePath(`/admin/warehouses/${id}`);
    return { success: true, warehouse };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A warehouse with this code already exists" };
    }
    console.error("Error updating warehouse:", error);
    return { error: "Failed to update warehouse" };
  }
}

export async function deleteWarehouse(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    // Check if warehouse has stock entries
    const stockCount = await db.warehouseStock.count({
      where: { warehouseId: id, physicalStock: { gt: 0 } },
    });

    if (stockCount > 0) {
      return { error: "Cannot delete warehouse with existing stock. Transfer or adjust stock first." };
    }

    // Check for active transfers
    const activeTransfers = await db.stockTransfer.count({
      where: {
        OR: [
          { fromWarehouseId: id },
          { toWarehouseId: id },
        ],
        status: { in: ["PENDING", "IN_TRANSIT"] },
      },
    });

    if (activeTransfers > 0) {
      return { error: "Cannot delete warehouse with active transfers." };
    }

    // Delete empty stock entries first, then warehouse
    await db.warehouseStock.deleteMany({ where: { warehouseId: id } });
    await db.warehouse.delete({ where: { id } });

    revalidatePath("/admin/warehouses");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting warehouse:", error);
    return { error: "Failed to delete warehouse" };
  }
}

// --- Warehouse Stock ---

export async function getWarehouseStock(warehouseId: string, search?: string) {
  const where: Prisma.WarehouseStockWhereInput = { warehouseId };

  if (search) {
    where.variant = {
      OR: [
        { sku: { contains: search, mode: "insensitive" } },
        { product: { slug: { contains: search, mode: "insensitive" } } },
      ],
    };
  }

  return await db.warehouseStock.findMany({
    where,
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, slug: true, content: true },
          },
        },
      },
    },
    orderBy: { variant: { sku: "asc" } },
  });
}

// --- Stock Transfers ---

export async function getStockTransfers() {
  return await db.stockTransfer.findMany({
    include: {
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      items: {
        include: {
          variant: {
            select: { id: true, sku: true, product: { select: { content: true, slug: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStockTransfer(id: string) {
  return await db.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: {
        include: {
          variant: {
            include: {
              product: { select: { content: true, slug: true } },
            },
          },
        },
      },
    },
  });
}

export async function createStockTransfer(data: z.infer<typeof createStockTransferSchema>) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = createStockTransferSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  if (parsed.data.fromWarehouseId === parsed.data.toWarehouseId) {
    return { error: "Source and destination warehouse must be different" };
  }

  try {
    // Validate stock availability in source warehouse
    for (const item of parsed.data.items) {
      const stock = await db.warehouseStock.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: parsed.data.fromWarehouseId,
            variantId: item.variantId,
          },
        },
      });

      const available = (stock?.physicalStock ?? 0) - (stock?.allocatedStock ?? 0);
      if (available < item.quantity) {
        const variant = await db.productVariant.findUnique({
          where: { id: item.variantId },
          select: { sku: true },
        });
        return { error: `Insufficient stock for ${variant?.sku || item.variantId}. Available: ${available}, Requested: ${item.quantity}` };
      }
    }

    const transferNumber = generateOrderNumber("ST");

    const transfer = await db.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId: parsed.data.fromWarehouseId,
        toWarehouseId: parsed.data.toWarehouseId,
        status: "PENDING",
        note: parsed.data.note || null,
        createdBy: session.user?.id || null,
        items: {
          create: parsed.data.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
    });

    revalidatePath("/admin/stock-transfers");
    return { success: true, transfer };
  } catch (error: unknown) {
    console.error("Error creating stock transfer:", error);
    return { error: "Failed to create stock transfer" };
  }
}

export async function completeStockTransfer(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const transfer = await db.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) return { error: "Transfer not found" };
    if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
      return { error: `Cannot complete transfer with status ${transfer.status}` };
    }

    await db.$transaction(async (tx) => {
      // Re-validate stock availability (may have changed since transfer was created)
      for (const item of transfer.items) {
        const [whStock] = await tx.$queryRawUnsafe<Array<{ physicalStock: number; allocatedStock: number }>>(
          `SELECT "physicalStock", "allocatedStock" FROM warehouse_stocks WHERE "warehouseId" = $1 AND "variantId" = $2 FOR UPDATE`,
          transfer.fromWarehouseId, item.variantId
        );
        const available = (whStock?.physicalStock ?? 0) - (whStock?.allocatedStock ?? 0);
        if (available < item.quantity) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { sku: true },
          });
          throw new Error(
            `Insufficient stock for ${variant?.sku || item.variantId} in source warehouse. Available: ${available}, Required: ${item.quantity}. Stock may have been consumed since this transfer was created.`
          );
        }
      }

      // Fetch warehouse names for audit trail
      const [fromWh, toWh] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: transfer.fromWarehouseId }, select: { name: true } }),
        tx.warehouse.findUnique({ where: { id: transfer.toWarehouseId }, select: { name: true } }),
      ]);

      // For each item: deduct from source, add to destination
      for (const item of transfer.items) {
        // Deduct from source warehouse
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_variantId: {
              warehouseId: transfer.fromWarehouseId,
              variantId: item.variantId,
            },
          },
          update: {
            physicalStock: { decrement: item.quantity },
          },
          create: {
            warehouseId: transfer.fromWarehouseId,
            variantId: item.variantId,
            physicalStock: -item.quantity, // Should not normally happen
          },
        });

        // Add to destination warehouse
        await tx.warehouseStock.upsert({
          where: {
            warehouseId_variantId: {
              warehouseId: transfer.toWarehouseId,
              variantId: item.variantId,
            },
          },
          update: {
            physicalStock: { increment: item.quantity },
          },
          create: {
            warehouseId: transfer.toWarehouseId,
            variantId: item.variantId,
            physicalStock: item.quantity,
          },
        });

        // Create inventory transactions for audit trail
        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            warehouseId: transfer.fromWarehouseId,
            quantity: -item.quantity,
            type: "TRANSFER",
            reference: transfer.transferNumber,
            note: `Stock transfer OUT to ${toWh?.name || transfer.toWarehouseId}`,
            createdBy: session.user?.id || null,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            warehouseId: transfer.toWarehouseId,
            quantity: item.quantity,
            type: "TRANSFER",
            reference: transfer.transferNumber,
            note: `Stock transfer IN from ${fromWh?.name || transfer.fromWarehouseId}`,
            createdBy: session.user?.id || null,
          },
        });

        // Sync global stock from warehouse stocks
        await syncVariantStockFromWarehouses(tx, item.variantId);
      }

      // Update transfer status
      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    });

    revalidatePath("/admin/stock-transfers");
    revalidatePath("/admin/warehouses");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error completing stock transfer:", error);
    return { error: "Failed to complete stock transfer" };
  }
}

export async function cancelStockTransfer(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const transfer = await db.stockTransfer.findUnique({ where: { id } });
    if (!transfer) return { error: "Transfer not found" };
    if (transfer.status === "COMPLETED" || transfer.status === "CANCELLED") {
      return { error: `Cannot cancel transfer with status ${transfer.status}` };
    }

    await db.stockTransfer.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/admin/stock-transfers");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling stock transfer:", error);
    return { error: "Failed to cancel stock transfer" };
  }
}

// --- Helper: Get all active warehouses for dropdowns ---

export async function getActiveWarehouses() {
  return await db.warehouse.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isDefault: true },
  });
}

// --- Helper: Search variants for transfer item selection ---

export async function searchVariantsForTransfer(query: string, warehouseId?: string) {
  const variants = await db.productVariant.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { product: { slug: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: {
      product: { select: { content: true, slug: true } },
      warehouseStocks: warehouseId
        ? { where: { warehouseId } }
        : undefined,
    },
    take: 20,
  });

  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    productSlug: v.product.slug,
    productContent: v.product.content,
    globalStock: v.physicalStock - v.allocatedStock,
    warehouseStock: warehouseId && v.warehouseStocks?.[0]
      ? v.warehouseStocks[0].physicalStock - v.warehouseStocks[0].allocatedStock
      : undefined,
  }));
}
