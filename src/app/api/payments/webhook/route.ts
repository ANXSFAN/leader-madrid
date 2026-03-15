import { NextResponse } from "next/server";
import {
  applyPaymentEvent,
  getPaymentProvider,
  mapPaymentStatus,
  verifyWebhookSignature,
} from "@/lib/services/payment-service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const provider =
    request.headers.get("x-payment-provider")?.toUpperCase() ||
    getPaymentProvider();

  const signature = request.headers.get("x-webhook-signature");
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (provider !== "MOCK") {
    const ok = verifyWebhookSignature(rawBody, signature, secret);
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else if (secret && signature) {
    const ok = verifyWebhookSignature(rawBody, signature, secret);
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let payload: any = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = payload.id || payload.eventId || payload.reference;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const eventType = payload.type || payload.eventType;
  const status = mapPaymentStatus(payload.status || payload.paymentStatus || eventType);

  const orderId = payload.orderId || payload.metadata?.orderId;
  const providerTransactionId = payload.transactionId || payload.paymentId;
  const amount = payload.amount !== undefined ? Number(payload.amount) : undefined;
  const currency = payload.currency;

  if (!orderId && !providerTransactionId) {
    return NextResponse.json({ error: "Missing order reference" }, { status: 400 });
  }

  const result = await applyPaymentEvent({
    provider,
    eventId,
    eventType,
    status,
    orderId,
    providerTransactionId,
    amount,
    currency,
    payload,
  });

  if (result && "error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ received: true });
}
