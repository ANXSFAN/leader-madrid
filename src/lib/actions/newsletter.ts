"use server";

import db from "@/lib/db";

export async function subscribeNewsletter(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "invalid_email" };
  }

  try {
    // @ts-ignore - model may not be generated yet
    const existing = await db.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      if (existing.active) {
        return { error: "already_subscribed" };
      }
      // Re-activate
      // @ts-ignore
      await db.newsletterSubscription.update({
        where: { email: email.toLowerCase() },
        data: { active: true },
      });
      return { success: true };
    }

    // @ts-ignore
    await db.newsletterSubscription.create({
      data: { email: email.toLowerCase() },
    });

    return { success: true };
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return { error: "server_error" };
  }
}
