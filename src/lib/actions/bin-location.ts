"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

// --- Schemas ---

const createBinLocationSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  code: z.string().min(1, "Bin code is required").transform((v) => v.toUpperCase()),
  zone: z.string().optional().nullable(),
  aisle: z.string().optional().nullable(),
  shelf: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const updateBinLocationSchema = z.object({
  code: z.string().min(1, "Bin code is required").transform((v) => v.toUpperCase()).optional(),
  zone: z.string().optional().nullable(),
  aisle: z.string().optional().nullable(),
  shelf: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// --- Bin Location CRUD ---

export async function createBinLocation(data: z.infer<typeof createBinLocationSchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = createBinLocationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    const bin = await db.binLocation.create({
      data: {
        warehouseId: parsed.data.warehouseId,
        code: parsed.data.code,
        zone: parsed.data.zone || null,
        aisle: parsed.data.aisle || null,
        shelf: parsed.data.shelf || null,
        description: parsed.data.description || null,
        isActive: true,
      },
    });

    revalidatePath("/admin/bin-locations");
    return { success: true, bin };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A bin location with this code already exists in this warehouse" };
    }
    console.error("Error creating bin location:", error);
    return { error: "Failed to create bin location" };
  }
}

export async function updateBinLocation(id: string, data: z.infer<typeof updateBinLocationSchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = updateBinLocationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    const bin = await db.binLocation.update({
      where: { id },
      data: {
        ...(parsed.data.code !== undefined && { code: parsed.data.code }),
        ...(parsed.data.zone !== undefined && { zone: parsed.data.zone || null }),
        ...(parsed.data.aisle !== undefined && { aisle: parsed.data.aisle || null }),
        ...(parsed.data.shelf !== undefined && { shelf: parsed.data.shelf || null }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });

    revalidatePath("/admin/bin-locations");
    return { success: true, bin };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A bin location with this code already exists in this warehouse" };
    }
    console.error("Error updating bin location:", error);
    return { error: "Failed to update bin location" };
  }
}

export async function deleteBinLocation(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    // Check if any lots are assigned to this bin
    const lotCount = await db.inventoryLot.count({
      where: { binLocationId: id },
    });
    if (lotCount > 0) {
      return { error: `Cannot delete: ${lotCount} lot(s) are still assigned to this bin location. Move or remove them first.` };
    }

    await db.binLocation.delete({ where: { id } });

    revalidatePath("/admin/bin-locations");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting bin location:", error);
    return { error: "Failed to delete bin location" };
  }
}

export async function toggleBinLocationStatus(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const bin = await db.binLocation.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!bin) return { error: "Bin location not found" };

    await db.binLocation.update({
      where: { id },
      data: { isActive: !bin.isActive },
    });

    revalidatePath("/admin/bin-locations");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error toggling bin location status:", error);
    return { error: "Failed to toggle status" };
  }
}

export async function getBinLocationContents(binLocationId: string) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  return await db.inventoryLot.findMany({
    where: { binLocationId },
    include: {
      variant: {
        include: {
          product: {
            select: { id: true, slug: true, content: true },
          },
        },
      },
    },
    orderBy: { lotNumber: "asc" },
  });
}

export async function assignLotToBin(lotId: string, binLocationId: string | null) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const lot = await db.inventoryLot.findUnique({
      where: { id: lotId },
      select: { warehouseId: true },
    });
    if (!lot) return { error: "Lot not found" };

    if (binLocationId) {
      const bin = await db.binLocation.findUnique({
        where: { id: binLocationId },
        select: { warehouseId: true, isActive: true },
      });
      if (!bin) return { error: "Bin location not found" };
      if (bin.warehouseId !== lot.warehouseId) {
        return { error: "Bin location must be in the same warehouse as the lot" };
      }
      if (!bin.isActive) {
        return { error: "Cannot assign to an inactive bin location" };
      }
    }

    await db.inventoryLot.update({
      where: { id: lotId },
      data: { binLocationId },
    });

    revalidatePath("/admin/bin-locations");
    revalidatePath("/admin/inventory-lots");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error assigning lot to bin:", error);
    return { error: "Failed to assign lot to bin" };
  }
}

export async function getBinLocations(warehouseId: string) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  return await db.binLocation.findMany({
    where: { warehouseId },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { lots: true } },
      lots: {
        select: { quantity: true },
      },
    },
  });
}

export async function getBinLocation(id: string) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  return await db.binLocation.findUnique({
    where: { id },
    include: {
      warehouse: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function getActiveBinLocations(warehouseId: string) {
  await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);

  return await db.binLocation.findMany({
    where: {
      warehouseId,
      isActive: true,
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      zone: true,
      aisle: true,
      shelf: true,
      description: true,
    },
  });
}
