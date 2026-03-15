import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendShipmentNotificationEmail } from "@/lib/email";

/**
 * SendCloud webhook payload structure.
 * Reference: https://docs.sendcloud.com/api/v2/#section/Webhooks
 *
 * This endpoint is designed to accept real SendCloud webhooks.
 * During development/mock mode it can also be called manually with the same structure.
 */
interface SendCloudParcelStatus {
  id: number;
  message: string;
}

interface SendCloudParcel {
  tracking_number: string;
  tracking_url: string;
  status: SendCloudParcelStatus;
  order_number?: string;
}

interface SendCloudWebhookPayload {
  action: string;
  timestamp: number;
  parcel: SendCloudParcel;
}

// Map SendCloud status IDs to our internal shipping status
// Full list: https://support.sendcloud.com/hc/en-us/articles/360024657051
function mapSendCloudStatusId(statusId: number): string | null {
  switch (statusId) {
    case 1:   return "PENDING";      // Announced
    case 3:   return "IN_TRANSIT";   // En route to sorting center
    case 12:  return "IN_TRANSIT";   // At sorting center
    case 5:   return "IN_TRANSIT";   // Delivery attempt failed
    case 11:  return "DELIVERED";    // Delivered
    case 2:   return "PROCESSING";   // En route to parcel store (pick-up)
    case 2000: return "RETURNED";    // Return shipment announced
    default:  return null;           // Unknown status — ignore
  }
}

function mapShippingStatusToOrderStatus(shippingStatus: string): string | null {
  switch (shippingStatus) {
    case "PENDING":     return "PENDING";
    case "PROCESSING":  return "PROCESSING";
    case "IN_TRANSIT":  return "SHIPPED";
    case "SHIPPED":     return "SHIPPED";
    case "DELIVERED":   return "DELIVERED";
    case "RETURNED":    return "RETURNED";
    default:            return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SENDCLOUD_SECRET_KEY;
    const rawBody = await req.text();

    // Verify webhook signature when secret is configured
    if (secret) {
      const signature = req.headers.get("x-webhook-signature") || req.headers.get("sendcloud-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as SendCloudWebhookPayload;

    // Only process parcel status change events
    if (payload.action !== "parcel_status_changed") {
      return NextResponse.json({ ok: true });
    }

    const { tracking_number, status, tracking_url } = payload.parcel;

    if (!tracking_number) {
      return NextResponse.json({ ok: true });
    }

    const shippingStatus = mapSendCloudStatusId(status.id);
    if (!shippingStatus) {
      // Unknown status — acknowledge to avoid retries
      return NextResponse.json({ ok: true });
    }

    // Find order by tracking number
    const order = await db.order.findFirst({
      where: { trackingNumber: tracking_number },
      include: { user: true },
    });

    if (!order) {
      console.warn(`[webhook/logistics] No order found for tracking: ${tracking_number}`);
      return NextResponse.json({ ok: true });
    }

    // Idempotency: skip if status already matches
    if (order.shippingStatus === shippingStatus) {
      return NextResponse.json({ ok: true, skipped: "already_at_status" });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      shippingStatus,
      trackingUrl: tracking_url || order.trackingUrl,
    };

    const orderStatus = mapShippingStatusToOrderStatus(shippingStatus);
    if (orderStatus) {
      updateData.status = orderStatus;
    }
    if (shippingStatus === "IN_TRANSIT" || shippingStatus === "SHIPPED") {
      updateData.shippedAt = updateData.shippedAt ?? order.shippedAt ?? new Date();
    }
    if (shippingStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    await db.order.update({
      where: { id: order.id },
      data: updateData,
    });

    // Send email notification for meaningful status transitions
    if (
      (shippingStatus === "IN_TRANSIT" || shippingStatus === "SHIPPED") &&
      !order.shippedAt &&
      order.user?.email
    ) {
      sendShipmentNotificationEmail({
        to: order.user.email,
        customerName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        status: "SHIPPED",
        trackingNumber: tracking_number,
        trackingUrl: tracking_url || order.trackingUrl || undefined,
      }).catch((err) => console.error("[webhook/logistics] Email error:", err));
    } else if (shippingStatus === "DELIVERED" && order.user?.email) {
      sendShipmentNotificationEmail({
        to: order.user.email,
        customerName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        status: "DELIVERED",
        trackingNumber: tracking_number,
      }).catch((err) => console.error("[webhook/logistics] Email error:", err));
    }

    revalidatePath("/profile/orders");
    revalidatePath(`/profile/orders/${order.id}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook/logistics] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
