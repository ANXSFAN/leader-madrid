"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

// --- Schemas ---

const createApprovalSchema = z.object({
  entityType: z.enum(["PURCHASE_ORDER", "DELIVERY_ORDER", "STOCK_ADJUSTMENT"]),
  entityId: z.string().min(1, "Entity ID is required"),
  reason: z.string().optional(),
});

const resolveApprovalSchema = z.object({
  id: z.string().min(1, "Approval ID is required"),
  comments: z.string().optional(),
});

const approvalFiltersSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  entityType: z.string().optional(),
  requestedBy: z.string().optional(),
});

// --- Helper: requiresApproval (pure function, not a server action) ---

/**
 * Determines if a given entity requires approval based on business rules.
 */
export async function requiresApproval(
  entityType: string,
  data: { totalAmount?: number; quantity?: number }
): Promise<boolean> {
  switch (entityType) {
    case "PURCHASE_ORDER":
      return (data.totalAmount ?? 0) > 5000;
    case "DELIVERY_ORDER":
      // Currently optional - always returns false
      return false;
    case "STOCK_ADJUSTMENT":
      return Math.abs(data.quantity ?? 0) > 100;
    default:
      return false;
  }
}

// --- Server Actions ---

/**
 * Creates a new approval request for an entity.
 * Any authenticated role can create an approval request.
 * Validates that no existing PENDING approval exists for the same entity.
 */
export async function createApprovalRequest(
  data: z.infer<typeof createApprovalSchema>
) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER", "CUSTOMER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = createApprovalSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  try {
    // Check for existing PENDING approval for same entity
    const existing = await db.approvalRequest.findFirst({
      where: {
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        status: "PENDING",
      },
    });

    if (existing) {
      return {
        error: "A pending approval request already exists for this entity",
      };
    }

    const approval = await db.approvalRequest.create({
      data: {
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        reason: parsed.data.reason || null,
        requestedBy: session.user!.id,
        status: "PENDING",
      },
    });

    revalidatePath("/admin/approvals");
    return { success: true, approval };
  } catch (error: unknown) {
    console.error("Error creating approval request:", error);
    return { error: "Failed to create approval request" };
  }
}

/**
 * Approves a pending approval request. ADMIN only.
 * After approval, triggers entity-specific status transitions:
 *   - PURCHASE_ORDER: DRAFT → SENT
 *   - DELIVERY_ORDER: DRAFT → CONFIRMED
 *   - STOCK_ADJUSTMENT: mark as approved (no additional status change)
 */
export async function approveRequest(id: string, comments?: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.$transaction(async (tx) => {
      // Lock the approval row to prevent concurrent approve/reject
      const [approval] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; entityType: string; entityId: string }>
      >(
        `SELECT id, status, "entityType", "entityId" FROM approval_requests WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!approval) throw new Error("Approval request not found");
      if (approval.status !== "PENDING") {
        throw new Error(`Cannot approve request with status ${approval.status}`);
      }

      // Update approval request
      await tx.approvalRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedBy: session.user!.id,
          resolvedAt: new Date(),
          comments: comments || null,
        },
      });

      // Trigger entity-specific actions
      switch (approval.entityType) {
        case "PURCHASE_ORDER": {
          const po = await tx.purchaseOrder.findUnique({
            where: { id: approval.entityId },
          });
          if (po && po.status === "DRAFT") {
            await tx.purchaseOrder.update({
              where: { id: approval.entityId },
              data: { status: "SENT" },
            });
          }
          break;
        }
        case "DELIVERY_ORDER": {
          const dOrder = await tx.deliveryOrder.findUnique({
            where: { id: approval.entityId },
          });
          if (dOrder && dOrder.status === "DRAFT") {
            await tx.deliveryOrder.update({
              where: { id: approval.entityId },
              data: {
                status: "CONFIRMED",
                confirmedAt: new Date(),
              },
            });
          }
          break;
        }
        case "STOCK_ADJUSTMENT": {
          // Stock adjustment is already pending — approval just marks it as approved.
          // The actual stock movement should be triggered by the caller after checking approval status.
          break;
        }
      }
    });

    // Revalidate relevant admin paths
    revalidatePath("/admin/approvals");
    revalidatePath("/admin/purchase-orders");
    revalidatePath("/admin/delivery-orders");
    revalidatePath("/admin/inventory");

    return { success: true };
  } catch (error: unknown) {
    console.error("Error approving request:", error);
    return { error: error instanceof Error ? error.message : "Failed to approve request" };
  }
}

/**
 * Rejects a pending approval request. ADMIN only.
 */
export async function rejectRequest(id: string, comments?: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.$transaction(async (tx) => {
      const [approval] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string }>
      >(
        `SELECT id, status FROM approval_requests WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!approval) throw new Error("Approval request not found");
      if (approval.status !== "PENDING") {
        throw new Error(`Cannot reject request with status ${approval.status}`);
      }

      await tx.approvalRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedBy: session.user!.id,
          resolvedAt: new Date(),
          comments: comments || null,
        },
      });
    });

    revalidatePath("/admin/approvals");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error rejecting request:", error);
    return { error: error instanceof Error ? error.message : "Failed to reject request" };
  }
}

/**
 * Cancels a pending approval request.
 * Only the original requester or an ADMIN can cancel.
 */
export async function cancelApprovalRequest(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER", "CUSTOMER"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.$transaction(async (tx) => {
      const [approval] = await tx.$queryRawUnsafe<
        Array<{ id: string; status: string; requestedBy: string }>
      >(
        `SELECT id, status, "requestedBy" FROM approval_requests WHERE id = $1 FOR UPDATE`,
        id
      );

      if (!approval) throw new Error("Approval request not found");
      if (approval.status !== "PENDING") {
        throw new Error(`Cannot cancel request with status ${approval.status}`);
      }

      // Only the requester or ADMIN can cancel
      const userRole = session.user?.role as string;
      if (approval.requestedBy !== session.user!.id && userRole !== "ADMIN") {
        throw new Error("Only the requester or an admin can cancel this request");
      }

      await tx.approvalRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    });

    revalidatePath("/admin/approvals");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error cancelling approval request:", error);
    return { error: error instanceof Error ? error.message : "Failed to cancel approval request" };
  }
}

/**
 * Lists approval requests with optional filters.
 * ADMIN and WAREHOUSE_MANAGER only.
 */
export async function getApprovalRequests(
  filters?: z.infer<typeof approvalFiltersSchema>
) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return [];

  const parsed = approvalFiltersSchema.safeParse(filters || {});
  const where: Record<string, unknown> = {};

  if (parsed.success) {
    if (parsed.data.status) where.status = parsed.data.status;
    if (parsed.data.entityType) where.entityType = parsed.data.entityType;
    if (parsed.data.requestedBy) where.requestedBy = parsed.data.requestedBy;
  }

  return await db.approvalRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
  });
}

/**
 * Gets a single approval request by ID.
 * ADMIN and WAREHOUSE_MANAGER only.
 */
export async function getApprovalRequest(id: string) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return null;

  return await db.approvalRequest.findUnique({
    where: { id },
  });
}

/**
 * Gets the latest approval request for a specific entity.
 * Any authenticated role can check approval status.
 */
export async function getApprovalForEntity(
  entityType: string,
  entityId: string
) {
  const session = await requireRole(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER", "CUSTOMER"]);
  if (!session) return null;

  return await db.approvalRequest.findFirst({
    where: { entityType, entityId },
    orderBy: { requestedAt: "desc" },
  });
}

/**
 * Returns the count of PENDING approval requests.
 * ADMIN only. Used for dashboard badge display.
 */
export async function getPendingApprovalsCount(): Promise<number> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return 0;

  return await db.approvalRequest.count({
    where: { status: "PENDING" },
  });
}
