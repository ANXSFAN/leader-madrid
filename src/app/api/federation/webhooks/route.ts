import { NextRequest, NextResponse } from "next/server";
import { validateFederationRequest } from "@/lib/federation-auth";
import db from "@/lib/db";

/**
 * POST /api/federation/webhooks
 * Receive webhook events from connected ERP instances.
 *
 * Authenticated via X-Federation-Key + HMAC signature.
 *
 * Body: { event: string, timestamp: string, data: unknown }
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const auth = await validateFederationRequest(req, rawBody);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (!event) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    // Log the incoming webhook
    await db.federationSyncLog.create({
      data: {
        nodeId: auth.nodeId,
        direction: "INBOUND",
        entityType: event.split(".")[0]?.toUpperCase() || "WEBHOOK",
        entityId: data?.orderId || data?.productId || undefined,
        action: event,
        status: "SUCCESS",
        payload: { event, dataKeys: data ? Object.keys(data) : [] },
      },
    });

    // Handle specific events
    switch (event) {
      case "product.updated":
      case "product.price_changed":
        // TODO: Phase 2 — trigger product sync
        break;

      case "order.confirmed":
      case "order.shipped":
      case "order.delivered":
      case "order.cancelled":
        // TODO: Phase 3 — update federation order status
        break;

      case "invoice.issued":
      case "invoice.paid":
        // TODO: Phase 5 — update settlement data
        break;

      case "inventory.updated":
        // TODO: Phase 6 — update cached inventory
        break;

      default:
        console.log(`[federation/webhooks] Unhandled event: ${event} from ${auth.nodeCode}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[federation/webhooks] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
