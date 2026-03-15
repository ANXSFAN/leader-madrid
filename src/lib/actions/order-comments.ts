"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function getOrderComments(orderId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  return db.orderComment.findMany({
    where: { orderId },
    include: { user: { select: { name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addOrderComment(orderId: string, content: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  if (!content.trim()) return { error: "Comment cannot be empty" };

  await db.orderComment.create({
    data: {
      orderId,
      userId: session.user!.id,
      content: content.trim(),
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function deleteOrderComment(commentId: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const comment = await db.orderComment.findUnique({ where: { id: commentId } });
  if (!comment) return { error: "Comment not found" };

  await db.orderComment.delete({ where: { id: commentId } });

  revalidatePath(`/admin/orders/${comment.orderId}`);
  return { success: true };
}
