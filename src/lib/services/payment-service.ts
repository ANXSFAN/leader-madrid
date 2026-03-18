import db from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { updateSOStatus } from "@/lib/actions/sales-order";
import {
  generateCecabankPaymentParams,
  verifyCecabankSignature,
  mapCecabankResponse,
  type CecabankFormParams,
} from "@/lib/providers/cecabank";

type PaymentEventInput = {
  provider: string;
  eventId: string;
  eventType?: string;
  status: PaymentStatus;
  orderId?: string;
  providerTransactionId?: string;
  amount?: number;
  currency?: string;
  payload?: unknown;
};

export function getPaymentProvider() {
  return (process.env.PAYMENT_PROVIDER || "MOCK").toUpperCase();
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
) {
  if (!secret || !signature) {
    return false;
  }
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const sigBuffer = Buffer.from(signature, "utf8");
  const digestBuffer = Buffer.from(digest, "utf8");
  if (sigBuffer.length !== digestBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, digestBuffer);
}

/**
 * Verify a Cecabank webhook notification signature.
 * Cecabank sends form-encoded POST with its own signature scheme.
 */
export function verifyCecabankWebhook(params: {
  numOperacion: string;
  importe: string;
  tipoMoneda: string;
  exponente: string;
  referencia?: string;
  firma: string;
}): boolean {
  return verifyCecabankSignature(
    {
      numOperacion: params.numOperacion,
      importe: params.importe,
      tipoMoneda: params.tipoMoneda,
      exponente: params.exponente,
      referencia: params.referencia,
    },
    params.firma
  );
}

/**
 * Map a Cecabank response code to our PaymentStatus.
 */
export function mapCecabankStatus(responseCode: string): PaymentStatus {
  return mapCecabankResponse(responseCode) as PaymentStatus;
}

export function mapPaymentStatus(input?: string) {
  const normalized = (input || "").toUpperCase();
  if (
    normalized === "PAID" ||
    normalized === "SUCCEEDED" ||
    normalized === "SUCCESS" ||
    normalized.includes("SUCCEEDED")
  ) {
    return "PAID" as PaymentStatus;
  }
  if (
    normalized === "FAILED" ||
    normalized === "DECLINED" ||
    normalized === "CANCELED" ||
    normalized.includes("FAILED")
  ) {
    return "FAILED" as PaymentStatus;
  }
  if (normalized === "REFUNDED" || normalized.includes("REFUND")) {
    return "REFUNDED" as PaymentStatus;
  }
  return "PENDING" as PaymentStatus;
}

export function sanitizePaymentPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const p = payload as Record<string, unknown>;
  const meta = p.metadata as Record<string, unknown> | undefined;

  return {
    id: p.id,
    eventId: p.eventId,
    type: p.type,
    eventType: p.eventType,
    status: p.status,
    paymentStatus: p.paymentStatus,
    amount: p.amount,
    currency: p.currency,
    orderId: p.orderId,
    transactionId: p.transactionId,
    paymentId: p.paymentId,
    reference: p.reference,
    metadata: meta?.orderId
      ? { orderId: meta.orderId }
      : undefined,
  };
}

export async function createPaymentTransaction(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      total: true,
      currency: true,
      paymentMethod: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const provider = getPaymentProvider();
  const transaction = await db.paymentTransaction.create({
    data: {
      orderId: order.id,
      provider,
      status: "PENDING",
      amount: order.total,
      currency: order.currency,
      metadata: {
        paymentMethod: order.paymentMethod,
      },
    },
  });

  const autoSuccess =
    provider === "MOCK" &&
    process.env.MOCK_PAYMENT_AUTO_SUCCESS === "true" &&
    order.paymentMethod !== "BANK_TRANSFER";

  if (autoSuccess) {
    await applyPaymentEvent({
      provider,
      eventId: `mock_${transaction.id}`,
      eventType: "payment.succeeded",
      status: "PAID",
      orderId: order.id,
      providerTransactionId: transaction.id,
      amount: Number(order.total),
      currency: order.currency,
      payload: { source: "mock_auto" },
    });
  }

  return transaction;
}

/**
 * Generate Cecabank TPV form parameters for a given order.
 * Returns the TPV URL and all hidden form fields needed for the redirect.
 */
export async function getCecabankPaymentForm(
  orderId: string,
  locale?: string
): Promise<CecabankFormParams> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  return generateCecabankPaymentParams({
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    locale,
  });
}

export async function applyPaymentEvent(input: PaymentEventInput) {
  const {
    provider,
    eventId,
    eventType,
    status,
    orderId,
    providerTransactionId,
    amount,
    currency,
    payload,
  } = input;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON field
  const sanitizedPayload = sanitizePaymentPayload(payload) as any;

  try {
    await db.paymentWebhookEvent.create({
      data: {
        provider,
        eventId,
        eventType,
        payload: sanitizedPayload,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "P2002") {
      return { ignored: true };
    }
  }

  let transaction = null;
  if (providerTransactionId) {
    transaction = await db.paymentTransaction.findFirst({
      where: { provider, providerTransactionId },
    });
  }

  if (!transaction && orderId) {
    transaction = await db.paymentTransaction.findFirst({
      where: { orderId, provider },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!transaction && orderId) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { total: true, currency: true },
    });
    if (order) {
      transaction = await db.paymentTransaction.create({
        data: {
          orderId,
          provider,
          providerTransactionId,
          status,
          amount: amount ?? order.total,
          currency: currency ?? order.currency,
          metadata: sanitizedPayload,
        },
      });
    }
  }

  if (!transaction) {
    return { ignored: false, error: "Transaction not found" };
  }

  const updatedOrder = await db.$transaction(async (tx) => {
    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        providerTransactionId:
          providerTransactionId ?? transaction.providerTransactionId,
        metadata: sanitizedPayload ?? transaction.metadata,
        amount: amount ?? transaction.amount,
        currency: currency ?? transaction.currency,
      },
    });

    const order = await tx.order.findUnique({
      where: { id: transaction.orderId },
      select: { status: true },
    });

    let nextOrderStatus = order?.status;
    if (
      status === "PAID" &&
      (order?.status === "PENDING" || order?.status === "DRAFT")
    ) {
      nextOrderStatus = "CONFIRMED";
    }
    if (status === "REFUNDED") {
      nextOrderStatus = "RETURNED";
    }
    if (status === "FAILED" && order?.status === "PENDING") {
      nextOrderStatus = "CANCELLED";
    }

    return tx.order.update({
      where: { id: transaction.orderId },
      data: {
        paymentStatus: status,
        status: nextOrderStatus,
      },
      select: { id: true, orderNumber: true, status: true },
    });
  });

  if (updatedOrder.orderNumber.startsWith("ORD-")) {
    const so = await db.salesOrder.findFirst({
      where: { orderNumber: updatedOrder.orderNumber },
      select: { id: true, status: true },
    });

    if (so) {
      if (status === "PAID" && so.status === "DRAFT") {
        await updateSOStatus(so.id, "CONFIRMED");
      } else if (
        status === "REFUNDED" &&
        (so.status === "DRAFT" || so.status === "CONFIRMED")
      ) {
        await updateSOStatus(so.id, "CANCELLED");
      } else if (
        status === "FAILED" &&
        (so.status === "DRAFT" || so.status === "CONFIRMED")
      ) {
        await updateSOStatus(so.id, "CANCELLED");
      }
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/profile");
  revalidatePath(`/admin/orders/${transaction.orderId}`);

  return { ignored: false, transactionId: transaction.id };
}
