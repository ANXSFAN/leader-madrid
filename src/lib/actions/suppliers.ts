"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";

export async function getSuppliers() {
  return await db.supplier.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
}) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const supplier = await db.supplier.create({
      data: {
        name: data.name,
        code: data.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20) + "-" + Date.now().toString(36),
        contact: {
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          website: data.website,
        },
      },
    });
    revalidatePath("/admin/suppliers");
    return { supplier };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }
}

export async function updateSupplier(
  id: string,
  data: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
  }
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const supplier = await db.supplier.update({
      where: { id },
      data: {
        name: data.name,
        contact: {
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          website: data.website,
        },
      },
    });
    revalidatePath("/admin/suppliers");
    return { supplier };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }
}

export async function deleteSupplier(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.supplier.delete({
      where: { id },
    });
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }
}
