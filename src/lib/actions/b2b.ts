"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { checkVIES } from "@/lib/vat";

// Spanish NIF/CIF/DNI/NIE format validation
function validateSpanishTaxId(taxId: string): { valid: boolean; type: string } {
  const upper = taxId.toUpperCase().trim();
  // Company NIF (CIF): 1 letter + 7 digits + 1 letter or digit
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(upper)) {
    return { valid: true, type: "CIF (Company)" };
  }
  // Individual DNI: 8 digits + 1 check letter
  if (/^\d{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(upper)) {
    return { valid: true, type: "DNI (Individual)" };
  }
  // Foreign resident NIE: X/Y/Z + 7 digits + 1 check letter
  if (/^[XYZ]\d{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(upper)) {
    return { valid: true, type: "NIE (Foreign Resident)" };
  }
  return { valid: false, type: "" };
}

export async function verifyB2BVAT(userId: string): Promise<{
  success?: boolean;
  isValid?: boolean;
  type?: string;
  name?: string;
  address?: string;
  message?: string;
  error?: string;
}> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { taxId: true, registrationCountry: true },
  });

  if (!user?.taxId) return { error: "No VAT number on record" };
  if (!user?.registrationCountry) return { error: "No registration country on record" };

  const { taxId, registrationCountry } = user;
  const country = registrationCountry.toUpperCase();

  // Spain: local format validation only
  if (country === "ES") {
    const result = validateSpanishTaxId(taxId);
    if (result.valid) {
      await db.user.update({
        where: { id: userId },
        data: { vatVerified: true, vatVerifiedAt: new Date() },
      });
      revalidatePath(`/admin/customers/${userId}`);
      return {
        success: true,
        isValid: true,
        type: result.type,
        message: `Valid Spanish ${result.type} format`,
      };
    } else {
      return {
        success: true,
        isValid: false,
        message: "Invalid format. Expected: CIF (A1234567A), DNI (12345678A), or NIE (X1234567A)",
      };
    }
  }

  // Other EU countries: call VIES API
  // Strip country prefix from taxId if user already included it (e.g. "FR30487773350" → "30487773350")
  const cleanedTaxId = taxId.toUpperCase().replace(/[\s\-\.]/g, "");
  const vatNumber = cleanedTaxId.startsWith(country) ? cleanedTaxId : `${country}${cleanedTaxId}`;
  const viesResult = await checkVIES(vatNumber);

  if (viesResult === null) {
    return { error: "VIES API unavailable. Please try again later or verify manually." };
  }

  if (viesResult.isValid) {
    await db.user.update({
      where: { id: userId },
      data: {
        vatVerified: true,
        vatVerifiedAt: new Date(),
        vatVerifiedName: viesResult.name || null,
        vatVerifiedAddress: viesResult.address || null,
      },
    });
    revalidatePath(`/admin/customers/${userId}`);
  }

  return {
    success: true,
    isValid: viesResult.isValid,
    name: viesResult.name,
    address: viesResult.address,
    message: viesResult.isValid ? "Valid EU VAT number (VIES verified)" : "Invalid or inactive VAT number in VIES database",
  };
}

export async function approveB2BUser(userId: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true, b2bStatus: true, vatVerified: true },
    });

    if (!user) return { error: "User not found" };
    if (user.b2bStatus !== "PENDING") {
      return { error: `Cannot approve user with b2bStatus: ${user.b2bStatus}. Only PENDING users can be approved.` };
    }
    if (!user.vatVerified) {
      console.warn(`[B2B] Approving user ${userId} without VAT verification`);
    }

    await db.user.update({
      where: { id: userId },
      data: { b2bStatus: "APPROVED", b2bReviewedAt: new Date(), b2bRejectionReason: null },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${userId}`);

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
  } catch {
    return { error: "Failed to approve user" };
  }
}

export async function rejectB2BUser(userId: string, reason: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true, b2bStatus: true },
    });

    if (!user) return { error: "User not found" };
    if (user.b2bStatus !== "PENDING" && user.b2bStatus !== "APPROVED") {
      return { error: `Cannot reject user with b2bStatus: ${user.b2bStatus}. Only PENDING or APPROVED users can be rejected.` };
    }

    await db.user.update({
      where: { id: userId },
      data: {
        b2bStatus: "REJECTED",
        b2bReviewedAt: new Date(),
        b2bRejectionReason: reason || null,
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${userId}`);

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
  } catch {
    return { error: "Failed to reject user" };
  }
}
