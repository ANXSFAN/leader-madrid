import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Role = "ADMIN" | "SALES_REP" | "WAREHOUSE_MANAGER" | "CUSTOMER";

const ADMIN_ROLES: Role[] = ["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"];

/**
 * Verifies the current user has one of the allowed roles.
 * Returns the session if authorized, or null if not.
 */
export async function requireRole(allowedRoles: Role[] = ADMIN_ROLES) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as string | undefined;
  if (!session?.user || !allowedRoles.includes(role as Role)) {
    return null;
  }
  return session;
}
