"use server";

import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getWishlist() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  return await db.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: {
          variants: { take: 1, orderBy: { price: "asc" } },
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleWishlistItem(productId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };

  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.user.id, productId } },
  });

  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/profile/wishlist");
    return { added: false };
  } else {
    try {
      await db.wishlistItem.create({
        data: { userId: session.user.id, productId },
      });
      revalidatePath("/profile/wishlist");
      return { added: true };
    } catch (error: unknown) {
      // Handle race condition: if another request created the item between check and create
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        await db.wishlistItem.delete({
          where: { userId_productId: { userId: session.user.id, productId } },
        });
        revalidatePath("/profile/wishlist");
        return { added: false };
      }
      throw error;
    }
  }
}

export async function removeFromWishlist(productId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };

  await db.wishlistItem.deleteMany({
    where: { userId: session.user.id, productId },
  });
  revalidatePath("/profile/wishlist");
  return { success: true };
}

export async function getWishlistProductIds(): Promise<string[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  const items = await db.wishlistItem.findMany({
    where: { userId: session.user.id },
    select: { productId: true },
  });
  return items.map((i) => i.productId);
}
