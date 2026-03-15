/**
 * Super Admin check — system owner protection.
 * Prevents customer ADMINs from accessing module toggles and other system-level settings.
 * Controlled via SUPER_ADMIN_EMAILS env var (comma-separated).
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const superAdminEmails =
    process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  return superAdminEmails.includes(email.toLowerCase());
}
