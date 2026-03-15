"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";
import { sendContactNotificationEmail } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
});

export async function submitContactForm(data: z.infer<typeof contactSchema>) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Validation failed", details: parsed.error.flatten() };
  }

  try {
    const submission = await db.contactSubmission.create({
      data: parsed.data,
    });

    // Send notification email to admin (non-blocking)
    sendContactNotificationEmail({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      subject: parsed.data.subject,
      message: parsed.data.message,
    }).catch(console.error);

    return { success: true, id: submission.id };
  } catch (err) {
    console.error("Contact form error:", err);
    return { error: "Failed to submit form" };
  }
}

export async function getContactSubmissions(status?: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return [];

  return db.contactSubmission.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateContactStatus(id: string, status: "NEW" | "READ" | "REPLIED") {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  await db.contactSubmission.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/cms/contact-submissions");
  return { success: true };
}
