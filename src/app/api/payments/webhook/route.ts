import { NextResponse } from "next/server";
import {
  applyPaymentEvent,
  getPaymentProvider,
  mapPaymentStatus,
  verifyWebhookSignature,
  verifyCecabankWebhook,
  mapCecabankStatus,
} from "@/lib/services/payment-service";
import db from "@/lib/db";

/**
 * Parse URL-encoded form body into a key-value record.
 */
function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const contentType = request.headers.get("content-type") || "";
  const provider =
    request.headers.get("x-payment-provider")?.toUpperCase() ||
    getPaymentProvider();

  // -----------------------------------------------------------------------
  // Cecabank: form-encoded notification
  // -----------------------------------------------------------------------
  if (
    provider === "CECABANK" ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = parseFormBody(rawBody);

    const numOperacion = formData["Num_operacion"] || "";
    const referencia = formData["Referencia"] || "";
    const importe = formData["Importe"] || "";
    const firma = formData["Firma"] || "";
    const codigoRespuesta = formData["Codigo_respuesta"] || "";
    const tipoMoneda = formData["TipoMoneda"] || "978";
    const exponente = formData["Exponente"] || "2";

    if (!numOperacion || !firma) {
      return NextResponse.json(
        { error: "Missing Cecabank fields" },
        { status: 400 }
      );
    }

    // Verify Cecabank signature
    const signatureOk = verifyCecabankWebhook({
      numOperacion,
      importe,
      tipoMoneda,
      exponente,
      referencia,
      firma,
    });

    if (!signatureOk) {
      console.error("[Cecabank webhook] Invalid signature", {
        numOperacion,
        importe,
      });
      return NextResponse.json(
        { error: "Invalid Cecabank signature" },
        { status: 400 }
      );
    }

    // Find order by orderNumber (Num_operacion)
    const order = await db.order.findFirst({
      where: { orderNumber: numOperacion },
      select: { id: true, total: true, currency: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found for Num_operacion: " + numOperacion },
        { status: 404 }
      );
    }

    const status = mapCecabankStatus(codigoRespuesta);
    const amountCents = parseInt(importe, 10);
    const amountEur = isNaN(amountCents) ? undefined : amountCents / 100;

    const result = await applyPaymentEvent({
      provider: "CECABANK",
      eventId: referencia || `ceca_${numOperacion}_${Date.now()}`,
      eventType:
        status === "PAID" ? "payment.succeeded" : "payment.failed",
      status,
      orderId: order.id,
      providerTransactionId: referencia || undefined,
      amount: amountEur,
      currency: "EUR",
      payload: formData,
    });

    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    // Cecabank expects "$*$OKY$*$" in the response body to acknowledge
    return new Response("$*$OKY$*$", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // -----------------------------------------------------------------------
  // Generic / MOCK / other providers: JSON payload
  // -----------------------------------------------------------------------
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
