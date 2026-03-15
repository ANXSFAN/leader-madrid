"use server";

import db from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const adminRoles = ["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"];

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as string;
  if (!adminRoles.includes(role)) return null;
  return session;
}

export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || !name) {
    return { error: "Faltan campos obligatorios" };
  }

  const privacyConsent = formData.get("privacy_consent");
  if (!privacyConsent) {
    return { error: "You must accept the privacy policy to register" };
  }

  const rl = rateLimit(`register:${email}`, RATE_LIMITS.register);
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.` };
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "El usuario ya existe" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "CUSTOMER",
        isActive: true,
        b2bStatus: "NOT_APPLIED",
      },
    });

    // Send welcome email (non-blocking)
    import("@/lib/email")
      .then(({ sendWelcomeEmail }) =>
        sendWelcomeEmail({ to: email, name })
      )
      .catch((e) => console.error("Welcome email failed:", e));

    return { success: "Registro exitoso." };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Algo salió mal durante el registro." };
  }
}

export async function approveUser(userId: string) {
  const session = await requireAdminSession();
  if (!session) return { error: "Unauthorized" };

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    await db.user.update({
      where: { id: userId },
      data: { b2bStatus: "APPROVED" },
    });

    revalidatePath("/admin/customers");

    if (user?.email) {
      try {
        const { sendB2BStatusEmail } = await import("@/lib/email");
        await sendB2BStatusEmail({
          to: user.email,
          customerName: user.name || user.email,
          companyName: user.companyName || "tu empresa",
          status: "APPROVED",
        });
      } catch (e) {
        console.error("B2B approval email failed:", e);
      }
    }

    return { success: true };
  } catch (error) {
    return { error: "Error al aprobar usuario" };
  }
}

export async function rejectUser(userId: string, reason?: string) {
  const session = await requireAdminSession();
  if (!session) return { error: "Unauthorized" };

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    await db.user.update({
      where: { id: userId },
      data: { b2bStatus: "REJECTED" },
    });

    revalidatePath("/admin/customers");

    if (user?.email) {
      try {
        const { sendB2BStatusEmail } = await import("@/lib/email");
        await sendB2BStatusEmail({
          to: user.email,
          customerName: user.name || user.email,
          companyName: user.companyName || "tu empresa",
          status: "REJECTED",
          reason,
        });
      } catch (e) {
        console.error("B2B rejection email failed:", e);
      }
    }

    return { success: true };
  } catch (error) {
    return { error: "Error al rechazar la solicitud" };
  }
}

export async function requestPasswordReset(email: string) {
  if (!email) return { error: "Email is required" };

  const rl = rateLimit(`pwreset:${email}`, RATE_LIMITS.passwordReset);
  if (!rl.allowed) return { success: true }; // Silent rate limit to prevent enumeration

  const user = await db.user.findUnique({ where: { email } });
  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  // Delete any existing tokens for this email
  await db.passwordResetToken.deleteMany({ where: { email } });

  const token = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: {
      token,
      email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const { sendPasswordResetEmail } = await import("@/lib/email");
    await sendPasswordResetEmail({
      to: email,
      name: user.name || email,
      resetUrl,
    });
  } catch (e) {
    console.error("Password reset email failed:", e);
  }

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token || !newPassword) return { error: "Invalid request" };
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters" };

  const resetToken = await db.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken) return { error: "Invalid or expired reset link" };
  if (resetToken.expiresAt < new Date()) {
    await db.passwordResetToken.delete({ where: { id: resetToken.id } });
    return { error: "Reset link has expired" };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { email: resetToken.email },
    data: { password: hashedPassword },
  });

  await db.passwordResetToken.delete({ where: { id: resetToken.id } });

  return { success: true };
}

export async function verifyEmail(token: string) {
  if (!token) return { error: "Invalid verification link" };

  const verificationToken = await db.emailVerificationToken.findUnique({ where: { token } });
  if (!verificationToken) return { error: "Invalid or expired verification link" };
  if (verificationToken.expiresAt < new Date()) {
    await db.emailVerificationToken.delete({ where: { id: verificationToken.id } });
    return { error: "Verification link has expired" };
  }

  await db.user.update({
    where: { email: verificationToken.email },
    data: { emailVerified: new Date() },
  });

  await db.emailVerificationToken.delete({ where: { id: verificationToken.id } });

  return { success: true };
}

export async function resendVerificationEmail(email: string) {
  if (!email) return { error: "Email is required" };

  const rl = rateLimit(`verify-resend:${email}`, RATE_LIMITS.verificationResend);
  if (!rl.allowed) return { success: true };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return { success: true };

  // Delete existing tokens
  await db.emailVerificationToken.deleteMany({ where: { email } });

  const token = crypto.randomBytes(32).toString("hex");
  await db.emailVerificationToken.create({
    data: {
      token,
      email,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    const { sendVerificationEmail } = await import("@/lib/email");
    await sendVerificationEmail({ to: email, name: user.name || email, verifyUrl });
  } catch (e) {
    console.error("Verification email failed:", e);
  }

  return { success: true };
}

export async function applyForB2B(userId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.id !== userId) {
    return { error: "Unauthorized" };
  }

  const companyName = formData.get("companyName") as string;
  const taxId = formData.get("taxId") as string;
  const industry = formData.get("industry") as string;
  const phone = formData.get("phone") as string;
  const phoneCountryCode = (formData.get("phoneCountryCode") as string) || "+34";
  const registrationCountry = formData.get("registrationCountry") as string;
  const companyStreet = formData.get("companyStreet") as string;
  const companyCity = formData.get("companyCity") as string;
  const companyZip = formData.get("companyZip") as string;

  if (!companyName || !taxId || !registrationCountry || !phone) {
    return { error: "Se requieren todos los campos obligatorios" };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    await db.user.update({
      where: { id: userId },
      data: {
        companyName,
        taxId,
        industry,
        phone,
        phoneCountryCode,
        registrationCountry,
        companyStreet,
        companyCity,
        companyZip,
        b2bStatus: "PENDING",
        b2bAppliedAt: new Date(),
        vatVerified: false,
        vatVerifiedAt: null,
        vatVerifiedName: null,
        vatVerifiedAddress: null,
      },
    });

    revalidatePath("/profile");

    if (user?.email) {
      try {
        const { sendB2BApplicationEmail } = await import("@/lib/email");
        await sendB2BApplicationEmail({
          to: user.email,
          customerName: user.name || user.email,
          companyName,
          taxId,
        });
      } catch (e) {
        console.error("B2B application email failed:", e);
      }
    }

    return { success: "Solicitud B2B enviada exitosamente." };
  } catch (error) {
    console.error("B2B Application error:", error);
    return { error: "Error al enviar la solicitud." };
  }
}
