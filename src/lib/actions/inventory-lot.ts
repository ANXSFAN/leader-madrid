"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

// --- Schemas ---

const createLotSchema = z.object({
  variantId: z.string().min(1, "Variant is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  binLocationId: z.string().optional().nullable(),
  lotNumber: z.string().min(1, "Lot number is required"),
  initialQuantity: z.number().int().min(1, "Initial quantity must be at least 1"),
  manufacturingDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const updateLotQuantitySchema = z.object({
  lotId: z.string().min(1, "Lot ID is required"),
  quantityChange: z.number().int().refine((v) => v !== 0, "Quantity change cannot be zero"),
  reason: z.string().optional(),
});

// --- Lot CRUD ---

export async function createLot(data: z.infer<typeof createLotSchema>) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = createLotSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  // Validate binLocationId belongs to the same warehouse
  if (parsed.data.binLocationId) {
    const bin = await db.binLocation.findUnique({
      where: { id: parsed.data.binLocationId },
      select: { warehouseId: true, isActive: true },
    });
    if (!bin) return { error: "Bin location not found" };
    if (bin.warehouseId !== parsed.data.warehouseId) {
      return { error: "Bin location does not belong to the selected warehouse" };
    }
    if (!bin.isActive) {
      return { error: "Bin location is inactive" };
    }
  }

  try {
    const lot = await db.inventoryLot.create({
      data: {
        variantId: parsed.data.variantId,
        warehouseId: parsed.data.warehouseId,
        binLocationId: parsed.data.binLocationId || null,
        lotNumber: parsed.data.lotNumber,
        initialQuantity: parsed.data.initialQuantity,
        quantity: parsed.data.initialQuantity,
        manufacturingDate: parsed.data.manufacturingDate || null,
        expiryDate: parsed.data.expiryDate || null,
        supplierId: parsed.data.supplierId || null,
        purchaseOrderId: parsed.data.purchaseOrderId || null,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, lot };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A lot with this lot number already exists" };
    }
    console.error("Error creating lot:", error);
    return { error: "Failed to create lot" };
  }
}

export async function updateLotQuantity(
  lotId: string,
  quantityChange: number,
  reason?: string
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = updateLotQuantitySchema.safeParse({ lotId, quantityChange, reason });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    const updatedLot = await db.$transaction(async (tx) => {
      // Lock the lot row to prevent concurrent quantity changes
      const [lot] = await tx.$queryRawUnsafe<
        Array<{ id: string; quantity: number }>
      >(
        `SELECT id, quantity FROM inventory_lots WHERE id = $1 FOR UPDATE`,
        parsed.data.lotId
      );

      if (!lot) throw new Error("Lot not found");

      const newQuantity = lot.quantity + parsed.data.quantityChange;
      if (newQuantity < 0) {
        throw new Error(
          `Cannot reduce quantity below 0. Current: ${lot.quantity}, Change: ${parsed.data.quantityChange}`
        );
      }

      return await tx.inventoryLot.update({
        where: { id: parsed.data.lotId },
        data: { quantity: newQuantity },
      });
    });

    revalidatePath("/admin/inventory");
    return { success: true, lot: updatedLot };
  } catch (error: unknown) {
    console.error("Error updating lot quantity:", error);
    return { error: error instanceof Error ? error.message : "Failed to update lot quantity" };
  }
}

export async function getLots(filters?: {
  variantId?: string;
  warehouseId?: string;
  expiringSoon?: boolean;
}) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  const where: Prisma.InventoryLotWhereInput = {};

  if (filters?.variantId) {
    where.variantId = filters.variantId;
  }

  if (filters?.warehouseId) {
    where.warehouseId = filters.warehouseId;
  }

  if (filters?.expiringSoon) {
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    where.expiryDate = {
      gt: now,
      lte: ninetyDaysFromNow,
    };
  }

  return await db.inventoryLot.findMany({
    where,
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, slug: true, content: true },
          },
        },
      },
      binLocation: {
        select: { id: true, code: true, zone: true, aisle: true, shelf: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLot(id: string) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  return await db.inventoryLot.findUnique({
    where: { id },
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, slug: true, content: true },
          },
        },
      },
      binLocation: {
        select: { id: true, code: true, zone: true, aisle: true, shelf: true },
      },
    },
  });
}

export async function getExpiringLots(daysAhead: number = 90) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return await db.inventoryLot.findMany({
    where: {
      expiryDate: {
        gt: now,
        lte: futureDate,
      },
      quantity: { gt: 0 },
    },
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, slug: true, content: true },
          },
        },
      },
      binLocation: {
        select: { id: true, code: true, zone: true, aisle: true, shelf: true },
      },
    },
    orderBy: { expiryDate: "asc" },
  });
}

export async function deleteLot(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const lot = await db.inventoryLot.findUnique({
      where: { id },
    });

    if (!lot) return { error: "Lot not found" };

    if (lot.quantity !== 0) {
      return { error: `Cannot delete lot with remaining quantity (${lot.quantity}). Adjust quantity to 0 first.` };
    }

    await db.inventoryLot.delete({ where: { id } });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting lot:", error);
    return { error: "Failed to delete lot" };
  }
}
