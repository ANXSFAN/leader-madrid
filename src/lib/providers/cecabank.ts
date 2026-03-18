/**
 * Cecabank TPV Virtual Payment Provider
 *
 * Implements the Cecabank redirect-based payment flow:
 * 1. Server generates signed form parameters
 * 2. Client POSTs a hidden form to Cecabank TPV URL
 * 3. Cecabank processes payment, then:
 *    a. POSTs server-to-server notification to our webhook
 *    b. Redirects user to success (URL_OK) or failure (URL_NOK) page
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CECABANK_SANDBOX_URL =
  "https://tpv.ceca.es/tpvweb/tpv/compra.action";
const CECABANK_PRODUCTION_URL =
  "https://pgw.ceca.es/tpvweb/tpv/compra.action";

function getConfig() {
  const merchantId = process.env.CECABANK_MERCHANT_ID;
  const acquirerBin = process.env.CECABANK_ACQUIRER_BIN;
  const terminalId = process.env.CECABANK_TERMINAL_ID;
  const secretKey = process.env.CECABANK_SECRET_KEY;
  const isSandbox = process.env.CECABANK_SANDBOX !== "false";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!merchantId || !acquirerBin || !terminalId || !secretKey) {
    throw new Error(
      "Cecabank configuration incomplete. Required env vars: " +
        "CECABANK_MERCHANT_ID, CECABANK_ACQUIRER_BIN, CECABANK_TERMINAL_ID, CECABANK_SECRET_KEY"
    );
  }

  return {
    merchantId,
    acquirerBin,
    terminalId,
    secretKey,
    isSandbox,
    appUrl,
    tpvUrl: isSandbox ? CECABANK_SANDBOX_URL : CECABANK_PRODUCTION_URL,
  };
}

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/**
 * Build the SHA-256 signature for Cecabank TPV.
 *
 * Cecabank specification:
 *   plainText = SecretKey + MerchantID + AcquirerBIN + TerminalID
 *             + Num_operacion + Importe + TipoMoneda + Exponente
 *             + "SHA2" + URL_OK + URL_NOK
 *   Firma = SHA256(plainText)
 */
export function buildCecabankSignature(params: {
  merchantId: string;
  acquirerBin: string;
  terminalId: string;
  numOperacion: string;
  importe: string;
  tipoMoneda: string;
  exponente: string;
  urlOk: string;
  urlNok: string;
  secretKey: string;
}): string {
  const plainText =
    params.secretKey +
    params.merchantId +
    params.acquirerBin +
    params.terminalId +
    params.numOperacion +
    params.importe +
    params.tipoMoneda +
    params.exponente +
    "SHA2" +
    params.urlOk +
    params.urlNok;

  return crypto.createHash("sha256").update(plainText, "utf8").digest("hex");
}

/**
 * Verify the signature received from Cecabank in a webhook notification.
 * Recalculates the expected signature and compares using timing-safe comparison.
 */
export function verifyCecabankSignature(
  params: {
    numOperacion: string;
    importe: string;
    tipoMoneda: string;
    exponente: string;
    referencia?: string;
  },
  receivedSignature: string
): boolean {
  const config = getConfig();

  // Cecabank notification signature uses the same formula
  const urlOk = `${config.appUrl}/checkout/payment-success`;
  const urlNok = `${config.appUrl}/checkout/payment-failed`;

  const expectedSignature = buildCecabankSignature({
    merchantId: config.merchantId,
    acquirerBin: config.acquirerBin,
    terminalId: config.terminalId,
    numOperacion: params.numOperacion,
    importe: params.importe,
    tipoMoneda: params.tipoMoneda,
    exponente: params.exponente,
    urlOk,
    urlNok,
    secretKey: config.secretKey,
  });

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const receivedBuf = Buffer.from(receivedSignature, "utf8");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

/**
 * Format amount in cents as a 12-digit string as required by Cecabank.
 * e.g. 99.50 EUR => "000000009950"
 */
function formatImporte(amount: number): string {
  const cents = Math.round(amount * 100);
  return cents.toString().padStart(12, "0");
}

// ---------------------------------------------------------------------------
// Payment parameters
// ---------------------------------------------------------------------------

export interface CecabankFormParams {
  tpvUrl: string;
  fields: Record<string, string>;
}

/**
 * Generate all form fields needed to redirect the customer to Cecabank TPV.
 */
export function generateCecabankPaymentParams(order: {
  id: string;
  orderNumber: string;
  total: number;
  locale?: string;
}): CecabankFormParams {
  const config = getConfig();

  const importe = formatImporte(order.total);
  const tipoMoneda = "978"; // EUR (ISO 4217 numeric)
  const exponente = "2";
  const numOperacion = order.orderNumber;

  const urlOk = `${config.appUrl}/${order.locale || "es"}/checkout/payment-success?orderId=${order.id}`;
  const urlNok = `${config.appUrl}/${order.locale || "es"}/checkout/payment-failed?orderId=${order.id}`;
  const urlNotificacion = `${config.appUrl}/api/payments/webhook`;

  const firma = buildCecabankSignature({
    merchantId: config.merchantId,
    acquirerBin: config.acquirerBin,
    terminalId: config.terminalId,
    numOperacion,
    importe,
    tipoMoneda,
    exponente,
    urlOk,
    urlNok,
    secretKey: config.secretKey,
  });

  return {
    tpvUrl: config.tpvUrl,
    fields: {
      MerchantID: config.merchantId,
      AcquirerBIN: config.acquirerBin,
      TerminalID: config.terminalId,
      Num_operacion: numOperacion,
      Importe: importe,
      TipoMoneda: tipoMoneda,
      Exponente: exponente,
      Cifrado: "SHA2",
      Firma: firma,
      Pago_soportado: "SSL",
      URL_OK: urlOk,
      URL_NOK: urlNok,
      URL_NOTIFICACION: urlNotificacion,
    },
  };
}

// ---------------------------------------------------------------------------
// Response code mapping
// ---------------------------------------------------------------------------

export type CecabankPaymentStatus = "PAID" | "FAILED" | "PENDING";

/**
 * Map Cecabank response code to our internal payment status.
 * "000" means approved; anything else is a failure.
 */
export function mapCecabankResponse(responseCode: string): CecabankPaymentStatus {
  if (responseCode === "000") {
    return "PAID";
  }
  return "FAILED";
}
