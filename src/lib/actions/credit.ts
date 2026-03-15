"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateCreditSchema = z.object({
  creditLimit: z.number().min(0).nullable(),
  paymentTermsDays: z.number().int().min(0).max(365),
});

export async function getCreditInfo(userId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      creditLimit: true,
      paymentTermsDays: true,
      currentBalance: true,
      name: true,
      email: true,
    },
  });
  return user;
}

export async function updateCreditSettings(
  userId: string,
  data: z.infer<typeof updateCreditSchema>
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = updateCreditSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid data" };

  await db.user.update({
    where: { id: userId },
    data: {
      creditLimit: parsed.data.creditLimit,
      paymentTermsDays: parsed.data.paymentTermsDays,
    },
  });

  revalidatePath(`/admin/customers/${userId}`);
  return { success: true };
}

export async function checkCreditAvailability(
  userId: string,
  orderAmount: number
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      creditLimit: true,
      currentBalance: true,
      paymentTermsDays: true,
    },
  });
  if (!user) return { allowed: false, reason: "User not found" };

  // No credit limit set = no restriction
  if (user.creditLimit === null) return { allowed: true };
  // Prepay customers = no credit check needed
  if (user.paymentTermsDays === 0) return { allowed: true };

  const available = Number(user.creditLimit) - Number(user.currentBalance);
  if (orderAmount > available) {
    return {
      allowed: false,
      reason: `Credit limit exceeded. Available: ${available.toFixed(2)}, Order: ${orderAmount.toFixed(2)}`,
      available,
      creditLimit: Number(user.creditLimit),
      currentBalance: Number(user.currentBalance),
    };
  }
  return { allowed: true, available };
}

/**
 * Internal helper — increments customer balance (no auth check).
 * Used by createOrder (CUSTOMER session) and admin actions.
 */
export async function chargeCustomerBalance(userId: string, amount: number) {
  await db.user.update({
    where: { id: userId },
    data: { currentBalance: { increment: amount } },
  });
}

/** Admin action to manually adjust (charge) customer balance */
export async function adminChargeCustomerBalance(userId: string, amount: number) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  await db.user.update({
    where: { id: userId },
    data: { currentBalance: { increment: amount } },
  });

  revalidatePath(`/admin/customers/${userId}`);
  return { success: true };
}

/** Admin action: record payment received — atomic decrement with floor at 0 */
export async function recordPayment(userId: string, amount: number) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  // Atomic: decrement but floor at 0 using raw SQL to avoid read-modify-write race
  await db.$executeRawUnsafe(
    `UPDATE users SET "currentBalance" = GREATEST(0, "currentBalance" - $1) WHERE id = $2`,
    amount,
    userId
  );

  revalidatePath(`/admin/customers/${userId}`);
  return { success: true };
}
