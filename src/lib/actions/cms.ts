"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";

export type BannerButton = {
  text: LocalizedString;
  link: string;
  variant: "primary" | "outline";
};

export type BannerStat = {
  label: LocalizedString;
  value: LocalizedString;
  icon: string;
};

/** A field that can be a plain string (legacy) or a locale→string map (new). */
export type LocalizedString = string | Record<string, string>;

export type BannerContent = {
  badge?: LocalizedString;
  heading: LocalizedString;
  highlightColor?: string;
  description?: LocalizedString;
  buttons: BannerButton[];
  stats: BannerStat[];
  alignment: "left" | "center";
};

export type BannerData = {
  title: string;
  imageUrl: string;
  isActive?: boolean;
  content: BannerContent;
};

export async function getBanners() {
  return await db.banner.findMany({
    orderBy: { order: "asc" },
  });
}

export async function getActiveBanners() {
  return await db.banner.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
}

export async function createBanner(data: BannerData) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const maxOrder = await db.banner.aggregate({
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order || 0) + 1;

  await db.banner.create({
    data: {
      title: data.title,
      imageUrl: data.imageUrl,
      isActive: data.isActive,
      order: nextOrder,
      content: data.content as unknown as Prisma.InputJsonValue, // Prisma JSON type workaround
    },
  });
  revalidatePath("/admin/cms/banners");
  revalidatePath("/");
}

export async function updateBanner(id: string, data: Partial<BannerData>) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON field update
  const updateData: any = { ...data };

  if (data.content) {
    updateData.content = data.content as unknown as Prisma.InputJsonValue;
  }

  await db.banner.update({
    where: { id },
    data: updateData,
  });
  revalidatePath("/admin/cms/banners");
  revalidatePath("/");
}

export async function deleteBanner(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  await db.banner.delete({
    where: { id },
  });
  revalidatePath("/admin/cms/banners");
  revalidatePath("/");
}

export async function reorderBanners(items: { id: string; order: number }[]) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  // Use a transaction to update all orders
  await db.$transaction(
    items.map((item) =>
      db.banner.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    )
  );
  revalidatePath("/admin/cms/banners");
  revalidatePath("/");
}
