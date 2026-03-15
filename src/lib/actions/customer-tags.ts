"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

// --- Types ---

export type CustomerTagWithCount = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number };
};

// --- Actions ---

export async function getCustomerTags(): Promise<{
  success: boolean;
  tags?: CustomerTagWithCount[];
  error?: string;
}> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const tags = await db.customerTag.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, tags };
  } catch (error) {
    console.error("Failed to fetch customer tags:", error);
    return { success: false, error: "Failed to fetch customer tags" };
  }
}

export async function createCustomerTag(data: {
  name: string;
  color: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.customerTag.create({
      data: {
        name: data.name.trim(),
        color: data.color,
      },
    });

    revalidatePath("/admin/customer-tags");
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (error: unknown) {
    // Handle unique constraint violation (P2002)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "A tag with this name already exists" };
    }
    console.error("Failed to create customer tag:", error);
    return { success: false, error: "Failed to create customer tag" };
  }
}

export async function updateCustomerTag(
  id: string,
  data: { name: string; color: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.customerTag.update({
      where: { id },
      data: {
        name: data.name.trim(),
        color: data.color,
      },
    });

    revalidatePath("/admin/customer-tags");
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "A tag with this name already exists" };
    }
    console.error("Failed to update customer tag:", error);
    return { success: false, error: "Failed to update customer tag" };
  }
}

export async function deleteCustomerTag(
  id: string
): Promise<{ success: boolean; userCount?: number; error?: string }> {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const tag = await db.customerTag.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!tag) {
      return { success: false, error: "Tag not found" };
    }

    await db.customerTag.delete({ where: { id } });

    revalidatePath("/admin/customer-tags");
    revalidatePath("/admin/customers");
    return { success: true, userCount: tag._count.users };
  } catch (error) {
    console.error("Failed to delete customer tag:", error);
    return { success: false, error: "Failed to delete customer tag" };
  }
}

export async function assignTagToUser(
  userId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        customerTags: {
          connect: { id: tagId },
        },
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${userId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to assign tag to user:", error);
    return { success: false, error: "Failed to assign tag" };
  }
}

export async function removeTagFromUser(
  userId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        customerTags: {
          disconnect: { id: tagId },
        },
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${userId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove tag from user:", error);
    return { success: false, error: "Failed to remove tag" };
  }
}
