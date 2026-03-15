"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

const categorySchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  content: z.record(z.unknown()), // JSON content with locale keys
  parentId: z.string().optional().nullable(),
});

export async function getCategories() {
  try {
    const categories = await db.category.findMany({
      orderBy: { slug: "asc" },
      include: {
        parent: true,
        children: true,
      },
    });
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function getCategory(id: string) {
  try {
    const category = await db.category.findUnique({
      where: { id },
      include: { parent: true },
    });
    return category;
  } catch (error) {
    console.error("Error fetching category:", error);
    return null;
  }
}

export async function createCategory(data: z.infer<typeof categorySchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const result = categorySchema.safeParse(data);

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Datos de categoría inválidos" };
  }

  try {
    const category = await db.category.create({
      data: {
        slug: result.data.slug,
        content: result.data.content as Prisma.InputJsonValue,
        parentId: result.data.parentId || null,
      },
    });
    revalidatePath("/admin/categories");
    return { success: true, category };
  } catch (error: unknown) {
    console.error("Error creating category:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create category");
  }
}

export async function updateCategory(id: string, data: z.infer<typeof categorySchema>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const result = categorySchema.safeParse(data);

  if (!result.success) {
    return { error: "Datos de categoría inválidos" };
  }

  try {
    const category = await db.category.update({
      where: { id },
      data: {
        slug: result.data.slug,
        content: result.data.content as Prisma.InputJsonValue,
        parentId: result.data.parentId || null,
      },
    });
    revalidatePath("/admin/categories");
    return { success: true, category };
  } catch (error: unknown) {
    console.error("Error updating category:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update category");
  }
}

export async function deleteCategory(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.$transaction(async (tx) => {
      // Collect all category IDs to be deleted (this category + descendants)
      const collectIds = async (categoryId: string): Promise<string[]> => {
        const children = await tx.category.findMany({
          where: { parentId: categoryId },
          select: { id: true },
        });
        const childIds: string[] = [];
        for (const child of children) {
          childIds.push(...await collectIds(child.id));
        }
        return [categoryId, ...childIds];
      };

      const idsToDelete = await collectIds(id);

      // Check if any products reference these categories
      const productCount = await tx.product.count({
        where: { categoryId: { in: idsToDelete } },
      });

      if (productCount > 0) {
        throw new Error(
          `Cannot delete: ${productCount} product(s) are assigned to this category or its subcategories. Reassign them first.`
        );
      }

      // Delete all categories (children first due to foreign key)
      // Reverse to delete leaves first
      for (const catId of idsToDelete.reverse()) {
        await tx.category.delete({ where: { id: catId } });
      }
    });

    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category" };
  }
}

export async function getCategoryDescendantIds(categoryId: string): Promise<string[]> {
  const ids = [categoryId];
  const children = await db.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });

  for (const child of children) {
    const childIds = await getCategoryDescendantIds(child.id);
    ids.push(...childIds);
  }
  return ids;
}
