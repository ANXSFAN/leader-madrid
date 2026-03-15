"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { generateApiKey, generateApiSecret } from "@/lib/federation-auth";

// ============================================
// Federation Node CRUD
// ============================================

export async function getFederationNodes() {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  return db.federationNode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      _count: {
        select: {
          channels: true,
          orders: true,
          syncLogs: true,
        },
      },
    },
  });
}

export async function getFederationNodeDetail(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  return db.federationNode.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      channels: {
        include: {
          _count: { select: { products: true } },
        },
      },
      _count: {
        select: {
          orders: true,
          syncLogs: true,
          settlements: true,
        },
      },
    },
  });
}

export async function createFederationNode(data: {
  name: string;
  code: string;
  type: "UPSTREAM" | "DOWNSTREAM";
  baseUrl: string;
  defaultCurrency?: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  supplierId?: string;
}) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();
  const inboundKey = generateApiKey();

  const node = await db.federationNode.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      type: data.type,
      baseUrl: data.baseUrl.replace(/\/+$/, ""),
      apiKey,
      apiSecret,
      inboundKey,
      defaultCurrency: data.defaultCurrency || "EUR",
      paymentTermsDays: data.paymentTermsDays || 30,
      creditLimit: data.creditLimit,
      supplierId: data.supplierId || undefined,
    },
  });

  revalidatePath("/admin/federation");
  return { node, apiKey, apiSecret, inboundKey };
}

export async function updateFederationNode(
  id: string,
  data: {
    name?: string;
    baseUrl?: string;
    defaultCurrency?: string;
    paymentTermsDays?: number;
    creditLimit?: number | null;
    supplierId?: string | null;
  }
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const node = await db.federationNode.update({
    where: { id },
    data: {
      ...data,
      baseUrl: data.baseUrl?.replace(/\/+$/, ""),
    },
  });

  revalidatePath("/admin/federation");
  revalidatePath(`/admin/federation/${id}`);
  return node;
}

export async function updateFederationNodeStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED" | "REVOKED"
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const node = await db.federationNode.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/admin/federation");
  revalidatePath(`/admin/federation/${id}`);
  return node;
}

export async function deleteFederationNode(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  // Only allow deleting PENDING or REVOKED nodes
  const node = await db.federationNode.findUnique({ where: { id } });
  if (!node) throw new Error("Node not found");
  if (node.status === "ACTIVE") {
    throw new Error("Cannot delete an active node. Revoke it first.");
  }

  await db.federationNode.delete({ where: { id } });

  revalidatePath("/admin/federation");
}

export async function regenerateNodeKeys(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();

  await db.federationNode.update({
    where: { id },
    data: { apiKey, apiSecret },
  });

  revalidatePath(`/admin/federation/${id}`);
  return { apiKey, apiSecret };
}

export async function regenerateInboundKey(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const inboundKey = generateApiKey();

  await db.federationNode.update({
    where: { id },
    data: { inboundKey },
  });

  revalidatePath(`/admin/federation/${id}`);
  return { inboundKey };
}

// ============================================
// Handshake (Connection Establishment)
// ============================================

/**
 * Initiate a handshake with a remote ERP instance.
 * Sends our inbound key and base URL to the remote instance.
 */
export async function initiateHandshake(nodeId: string, ourBaseUrl: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const node = await db.federationNode.findUnique({ where: { id: nodeId } });
  if (!node) throw new Error("Node not found");

  // Call the remote instance's handshake endpoint
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    nodeCode: node.code,
    nodeName: node.name,
    nodeType: node.type === "UPSTREAM" ? "DOWNSTREAM" : "UPSTREAM", // From their perspective
    baseUrl: ourBaseUrl,
    inboundKey: node.inboundKey,
  });

  const response = await fetch(`${node.baseUrl}/api/federation/handshake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Federation-Key": node.apiKey,
      "X-Federation-Timestamp": timestamp,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Handshake failed: ${error}`);
  }

  const result = await response.json();

  // Update node status
  await db.federationNode.update({
    where: { id: nodeId },
    data: { status: "ACTIVE", lastSyncAt: new Date() },
  });

  revalidatePath("/admin/federation");
  revalidatePath(`/admin/federation/${nodeId}`);
  return result;
}

// ============================================
// Sync Logs
// ============================================

export async function getFederationSyncLogs(
  nodeId: string,
  options?: {
    page?: number;
    pageSize?: number;
    entityType?: string;
    status?: string;
  }
) {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;

  const where: Record<string, unknown> = { nodeId };
  if (options?.entityType) where.entityType = options.entityType;
  if (options?.status) where.status = options.status;

  const [logs, total] = await Promise.all([
    db.federationSyncLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.federationSyncLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ============================================
// Dashboard Stats
// ============================================

export async function getFederationStats() {
  const session = await requireRole(["ADMIN"]);
  if (!session) throw new Error("Unauthorized");

  const [
    totalNodes,
    activeNodes,
    pendingNodes,
    recentLogs,
  ] = await Promise.all([
    db.federationNode.count(),
    db.federationNode.count({ where: { status: "ACTIVE" } }),
    db.federationNode.count({ where: { status: "PENDING" } }),
    db.federationSyncLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: "FAILED",
      },
    }),
  ]);

  return {
    totalNodes,
    activeNodes,
    pendingNodes,
    failedSyncsLast24h: recentLogs,
  };
}
