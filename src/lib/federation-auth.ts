import crypto from "crypto";
import { NextRequest } from "next/server";
import db from "@/lib/db";

export interface FederationAuthResult {
  nodeId: string;
  nodeCode: string;
  nodeType: "UPSTREAM" | "DOWNSTREAM";
}

/**
 * Validate an inbound federation API request.
 * Checks the X-Federation-Key header against known inboundKeys,
 * then verifies the HMAC-SHA256 signature.
 *
 * Headers expected:
 *   X-Federation-Key: <inboundKey>
 *   X-Federation-Timestamp: <unix timestamp in seconds>
 *   X-Federation-Signature: <hmac hex digest>
 *
 * Signature = HMAC-SHA256(apiSecret, timestamp + "\n" + method + "\n" + pathname + "\n" + body)
 */
export async function validateFederationRequest(
  req: NextRequest,
  rawBody: string
): Promise<FederationAuthResult | null> {
  const apiKey = req.headers.get("x-federation-key");
  const timestamp = req.headers.get("x-federation-timestamp");
  const signature = req.headers.get("x-federation-signature");

  if (!apiKey || !timestamp || !signature) {
    return null;
  }

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  const reqTime = parseInt(timestamp, 10);
  if (isNaN(reqTime) || Math.abs(now - reqTime) > 300) {
    return null;
  }

  // Find the federation node by inbound key
  const node = await db.federationNode.findUnique({
    where: { inboundKey: apiKey },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      apiSecret: true,
    },
  });

  if (!node || node.status !== "ACTIVE") {
    return null;
  }

  // Verify HMAC signature
  const method = req.method.toUpperCase();
  const pathname = new URL(req.url).pathname;
  const payload = `${timestamp}\n${method}\n${pathname}\n${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", node.apiSecret)
    .update(payload)
    .digest("hex");

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isValid) return null;
  } catch {
    return null;
  }

  return {
    nodeId: node.id,
    nodeCode: node.code,
    nodeType: node.type,
  };
}

/**
 * Generate a cryptographically secure API key.
 */
export function generateApiKey(): string {
  return `fed_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Generate a cryptographically secure API secret for HMAC signing.
 */
export function generateApiSecret(): string {
  return crypto.randomBytes(48).toString("hex");
}
