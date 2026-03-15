"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { Prisma } from "@prisma/client";

export async function getAuditLogs(params: {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { logs: [], total: 0, page: 1, pageSize: 25 };

  const { page = 1, pageSize = 25, userId, action, entityType, dateFrom, dateTo } = params;

  const where: Prisma.AuditLogWhereInput = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59");
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize };
}
