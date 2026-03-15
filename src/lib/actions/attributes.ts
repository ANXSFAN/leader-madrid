"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth-guard";

export type AttributeWithOptions = {
  key: string;
  name: Record<string, string>;
  type: string;
  unit: string | null;
  isHighlight: boolean;
  isFilterable: boolean;
  sortOrder: number;
  options: {
    value: string;
    color: string | null;
  }[];
};

export const getGlobalAttributes = unstable_cache(
  async (): Promise<AttributeWithOptions[]> => {
    const attributes = await db.attributeDefinition.findMany({
      include: {
        options: {
          orderBy: {
            value: "asc",
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { key: "asc" }],
    });

    return attributes.map((attr) => ({
      key: attr.key,
      name: attr.name as Record<string, string>,
      type: attr.type,
      unit: attr.unit,
      isHighlight: attr.isHighlight ?? false,
      isFilterable: attr.isFilterable ?? false,
      sortOrder: attr.sortOrder ?? 0,
      options: attr.options.map((opt) => ({
        value: opt.value,
        color: opt.color,
      })),
    }));
  },
  ["global-attributes"],
  { revalidate: 3600, tags: ["attributes"] }
);

export async function createAttribute(data: {
  key: string;
  name: Record<string, string>;
  type: "TEXT" | "NUMBER" | "SELECT";
  unit?: string;
  scope: "PRODUCT" | "VARIANT";
  isHighlight?: boolean;
  isFilterable?: boolean;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const attribute = await db.attributeDefinition.create({
      data: {
        key: data.key,
        name: data.name,
        type: data.type,
        unit: data.unit,
        scope: data.scope,
        isHighlight: data.isHighlight ?? false,
        isFilterable: data.isFilterable ?? false,
      },
    });
    revalidatePath("/admin/attributes");
    revalidateTag("attributes", "default");
    return { attribute };
  } catch (error: unknown) {
    // Unique constraint violation for key
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Attribute key already exists" };
    }
    return { error: error instanceof Error ? error.message : "Failed to create attribute" };
  }
}

export async function updateAttribute(
  id: string,
  data: {
    key: string;
    name: Record<string, string>;
    type: "TEXT" | "NUMBER" | "SELECT";
    unit?: string;
    scope: "PRODUCT" | "VARIANT";
    isHighlight?: boolean;
    isFilterable?: boolean;
  }
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const attribute = await db.attributeDefinition.update({
      where: { id },
      data: {
        key: data.key,
        name: data.name,
        type: data.type,
        unit: data.unit,
        scope: data.scope,
        isHighlight: data.isHighlight ?? false,
        isFilterable: data.isFilterable ?? false,
      },
    });
    revalidatePath("/admin/attributes");
    revalidatePath(`/admin/attributes/${id}`);
    revalidateTag("attributes", "default");
    return { attribute };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Attribute key already exists" };
    }
    return { error: error instanceof Error ? error.message : "Failed to update attribute" };
  }
}

export async function addAttributeOption(
  attributeId: string,
  value: string,
  color?: string
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const option = await db.attributeOption.create({
      data: {
        attributeId,
        value,
        color: color || null,
      },
    });
    revalidatePath(`/admin/attributes/${attributeId}`);
    revalidateTag("attributes", "default");
    return { option };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to add option" };
  }
}

export async function deleteAttribute(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.attributeDefinition.delete({ where: { id } });
    revalidatePath("/admin/attributes");
    revalidateTag("attributes", "default");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to delete attribute" };
  }
}

export async function updateAttributeSortOrder(orderedIds: string[]) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const ids = orderedIds;
    const orders = orderedIds.map((_, i) => i);
    await db.$executeRaw`
      UPDATE attribute_definitions SET "sortOrder" = data.new_order
      FROM unnest(${ids}, ${orders}::int[]) AS data(id, new_order)
      WHERE attribute_definitions.id::text = data.id
    `;
    revalidatePath("/admin/attributes");
    revalidateTag("attributes", "default");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating attribute sort order:", error);
    return { error: "Failed to update sort order" };
  }
}

export async function toggleAttributePinned(id: string, pinned: boolean) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.attributeDefinition.update({
      where: { id },
      data: { isPinned: pinned },
    });
    revalidatePath("/admin/attributes");
    revalidateTag("attributes", "default");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error toggling attribute pinned:", error);
    return { error: "Failed to toggle pinned status" };
  }
}

export async function deleteAttributeOption(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    // Find option first to get attributeId for revalidation (optional but good)
    const option = await db.attributeOption.findUnique({
      where: { id },
      select: { attributeId: true },
    });

    await db.attributeOption.delete({
      where: { id },
    });

    if (option) {
      revalidatePath(`/admin/attributes/${option.attributeId}`);
    }
    revalidateTag("attributes", "default");
    return { success: true };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to delete option" };
  }
}
