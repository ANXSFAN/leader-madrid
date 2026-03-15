"use server";

import db from "@/lib/db";
import { CmsPageType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";

export async function getCmsPages(type?: CmsPageType) {
  return db.cmsPage.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

export async function getCmsPageBySlug(slug: string) {
  return db.cmsPage.findUnique({
    where: { slug },
  });
}

export async function getCmsPagesByMenuGroup(group: string) {
  return db.cmsPage.findMany({
    where: { menuGroup: group, isActive: true },
    orderBy: { order: "asc" },
  });
}

export async function createCmsPage(data: {
  slug: string;
  type: CmsPageType;
  content: Prisma.InputJsonValue;
  attachmentUrl?: string;
  imageUrl?: string;
  order?: number;
  isActive?: boolean;
  menuGroup?: string;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const page = await db.cmsPage.create({
      data: {
        slug: data.slug,
        type: data.type,
        content: data.content,
        attachmentUrl: data.attachmentUrl || null,
        imageUrl: data.imageUrl || null,
        order: data.order || 0,
        isActive: data.isActive ?? true,
        menuGroup: data.menuGroup || null,
      },
    });
    revalidatePath("/admin/cms/pages");
    revalidatePath("/");
    return { success: true, id: page.id };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A page with this slug already exists" };
    }
    console.error("Create CMS page error:", err);
    return { error: "Failed to create page" };
  }
}

export async function updateCmsPage(id: string, data: {
  slug?: string;
  type?: CmsPageType;
  content?: Prisma.InputJsonValue;
  attachmentUrl?: string | null;
  imageUrl?: string | null;
  order?: number;
  isActive?: boolean;
  menuGroup?: string | null;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.cmsPage.update({
      where: { id },
      data: {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.attachmentUrl !== undefined && { attachmentUrl: data.attachmentUrl }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.menuGroup !== undefined && { menuGroup: data.menuGroup }),
      },
    });
    revalidatePath("/admin/cms/pages");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A page with this slug already exists" };
    }
    console.error("Update CMS page error:", err);
    return { error: "Failed to update page" };
  }
}

export async function deleteCmsPage(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  await db.cmsPage.delete({ where: { id } });
  revalidatePath("/admin/cms/pages");
  revalidatePath("/");
  return { success: true };
}
