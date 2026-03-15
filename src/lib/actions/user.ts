"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";

const userSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["CUSTOMER", "ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]),
  b2bStatus: z.enum(["NOT_APPLIED", "PENDING", "APPROVED", "REJECTED"]),
  customerLevel: z.string().optional().nullable(),
  priceListId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function createUser(data: z.infer<typeof userSchema> & { name?: string; email?: string }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as string | undefined;
  if (!session?.user || !["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"].includes(role || "")) {
    return { error: "Unauthorized" };
  }

  const validData = userSchema.parse(data);

  // Only ADMIN can assign privileged roles; non-ADMIN users can only create CUSTOMER accounts
  const callerRole = role;
  let effectiveRole = validData.role;
  let effectiveB2bStatus = validData.b2bStatus;
  if (callerRole !== "ADMIN") {
    effectiveRole = "CUSTOMER";
    if (effectiveB2bStatus === "APPROVED") {
      effectiveB2bStatus = "PENDING";
    }
  }

  try {
    const user = await db.user.create({
      data: {
        name: data.name || "",
        email: data.email || "",
        role: effectiveRole,
        b2bStatus: effectiveB2bStatus,
        isActive: validData.isActive,
        customerLevel: validData.customerLevel || null,
      },
    });

    revalidatePath("/admin/customers");
    return { user };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to create user" };
  }
}

export async function updateUser(
  userId: string,
  data: z.infer<typeof userSchema>
) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as string | undefined;
    if (!session?.user || !["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"].includes(role || "")) {
      return { error: "Unauthorized" };
    }

    const parsed = userSchema.parse(data);

    // Only ADMIN can assign privileged roles
    const callerRole = role;
    const validData = {
      ...parsed,
      role: callerRole !== "ADMIN" ? "CUSTOMER" as const : parsed.role,
      b2bStatus: (callerRole !== "ADMIN" && parsed.b2bStatus === "APPROVED") ? "PENDING" as const : parsed.b2bStatus,
    };

    // ADMIN role automatically gets B2B APPROVED
    if (validData.role === "ADMIN" && validData.b2bStatus !== "APPROVED") {
      validData.b2bStatus = "APPROVED";
    }

    const { priceListId, ...userData } = validData;

    const updateData: Prisma.UserUpdateInput = { ...userData };

    if (priceListId !== undefined) {
      updateData.priceLists = priceListId
        ? { set: [{ id: priceListId }] }
        : { set: [] };
    }

    await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return { error: "Failed to update user" };
  }
}

export async function getUser(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as string | undefined;
    if (!session?.user || !["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"].includes(role || "")) {
      return { error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        priceLists: {
          include: {
            rules: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: { content: true, slug: true, sku: true },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" as const },
            },
          },
        },
        customerTags: true,
      },
    });

    if (!user) return { error: "User not found" };

    const userWithPriceListId = {
      ...user,
      priceListId: user.priceLists[0]?.id || null,
    };

    return { user: userWithPriceListId };
  } catch (error) {
    return { error: "User not found" };
  }
}

export async function bulkAssignPriceList(userIds: string[], priceListId: string | null) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };
  if (userIds.length === 0) return { error: "No customers selected" };

  try {
    await Promise.all(
      userIds.map((id) =>
        db.user.update({
          where: { id },
          data: {
            priceLists: priceListId ? { set: [{ id: priceListId }] } : { set: [] },
          },
        })
      )
    );
    revalidatePath("/admin/customers");
    return { success: true, count: userIds.length };
  } catch (error) {
    console.error("Error bulk assigning price list:", error);
    return { error: "Failed to assign price list" };
  }
}
