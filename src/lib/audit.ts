import db from "@/lib/db";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";

interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  userId?: string | null;
  userName?: string | null;
}

export async function createAuditLog(input: AuditLogInput) {
  return db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      changes: (input.changes as any) ?? undefined,
      userId: input.userId ?? null,
      userName: input.userName ?? null,
    },
  });
}

/**
 * Compares two objects and returns a diff of changed fields.
 * Only includes top-level scalar/JSON fields that differ.
 */
export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];

    // Deep comparison for JSON values
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);

    if (oldStr !== newStr) {
      changes[field] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

export async function getAuditLogs(entityType: string, entityId: string, limit = 50) {
  return db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
