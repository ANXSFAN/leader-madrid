import crypto from "crypto";
import db from "@/lib/db";

interface FederationRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  timeout?: number;
}

interface FederationResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Send a signed request to a federation node.
 * Automatically attaches API Key + HMAC signature headers.
 * Logs the request/response to FederationSyncLog.
 */
export async function federationRequest<T = unknown>(
  nodeId: string,
  path: string,
  options: FederationRequestOptions = {}
): Promise<FederationResponse<T>> {
  const { method = "GET", body, timeout = 30000 } = options;

  // Get node connection details
  const node = await db.federationNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      baseUrl: true,
      apiKey: true,
      apiSecret: true,
      status: true,
    },
  });

  if (!node) {
    throw new Error(`Federation node not found: ${nodeId}`);
  }

  if (node.status !== "ACTIVE") {
    throw new Error(`Federation node is not active: ${nodeId} (status: ${node.status})`);
  }

  const url = `${node.baseUrl.replace(/\/+$/, "")}${path}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";

  // Create HMAC signature
  const payload = `${timestamp}\n${method}\n${path}\n${bodyStr}`;
  const signature = crypto
    .createHmac("sha256", node.apiSecret)
    .update(payload)
    .digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Federation-Key": node.apiKey,
    "X-Federation-Timestamp": timestamp,
    "X-Federation-Signature": signature,
  };

  let response: Response;
  let responseData: T;
  let logStatus = "SUCCESS";
  let errorMsg: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    response = await fetch(url, {
      method,
      headers,
      body: bodyStr || undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    responseData = (await response.json()) as T;

    if (!response.ok) {
      logStatus = "FAILED";
      errorMsg = `HTTP ${response.status}: ${JSON.stringify(responseData)}`;
    }
  } catch (error) {
    logStatus = "FAILED";
    errorMsg = error instanceof Error ? error.message : "Unknown error";
    throw error;
  } finally {
    // Log the request (non-blocking)
    db.federationSyncLog
      .create({
        data: {
          nodeId: node.id,
          direction: "OUTBOUND",
          entityType: path.split("/")[3]?.toUpperCase() || "UNKNOWN",
          action: method === "GET" ? "SYNC" : method === "POST" ? "CREATE" : "UPDATE",
          status: logStatus,
          payload: {
            url,
            method,
            requestBody: body ? "(redacted)" : undefined,
            responseStatus: response!?.status,
          },
          errorMsg,
        },
      })
      .catch((err: unknown) => console.error("[federation-client] Log error:", err));
  }

  // Update lastSyncAt on success
  if (logStatus === "SUCCESS") {
    db.federationNode
      .update({
        where: { id: node.id },
        data: { lastSyncAt: new Date(), lastError: null },
      })
      .catch((err: unknown) => console.error("[federation-client] Update error:", err));
  } else {
    db.federationNode
      .update({
        where: { id: node.id },
        data: { lastError: errorMsg },
      })
      .catch((err: unknown) => console.error("[federation-client] Update error:", err));
  }

  return {
    ok: response!.ok,
    status: response!.status,
    data: responseData!,
  };
}

/**
 * Send a webhook event to a federation node.
 * This is a convenience wrapper that posts to /api/federation/webhooks.
 */
export async function sendFederationWebhook(
  nodeId: string,
  event: string,
  data: unknown
): Promise<void> {
  try {
    await federationRequest(nodeId, "/api/federation/webhooks", {
      method: "POST",
      body: {
        event,
        timestamp: new Date().toISOString(),
        data,
      },
    });
  } catch (error) {
    console.error(`[federation-webhook] Failed to send ${event} to node ${nodeId}:`, error);
  }
}
