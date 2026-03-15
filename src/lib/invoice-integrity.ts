import { createHash } from "crypto";

/**
 * Data structure representing the immutable financial content of an invoice.
 * Used to compute the integrity hash at creation time.
 */
export interface InvoiceHashPayload {
  invoiceNumber: string;
  issueDate: string; // ISO string
  totalAmount: string;
  subtotal: string;
  tax: string;
  shipping: string;
  currency: string;
  exchangeRate: string;
  vatRate: string;
  isReverseCharge: boolean;
  buyerVatNumber: string | null;
  sellerSnapshot: Record<string, unknown>;
  buyerSnapshot: Record<string, unknown>;
  lineItems: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  // VeriFactu chain hash (Ley 11/2021)
  previousHash: string | null;
}

/**
 * Recursively sort all keys in an object/array to ensure deterministic
 * JSON.stringify output regardless of insertion order or JS engine.
 */
function deepSortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Compute a deterministic SHA-256 hash of the invoice's financial data.
 * All nested objects are recursively key-sorted before serialization.
 * Includes previousHash for VeriFactu chain integrity.
 */
export function computeInvoiceHash(payload: InvoiceHashPayload): string {
  const sorted = deepSortKeys(payload);
  const canonical = JSON.stringify(sorted);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Verify an invoice's integrity by recomputing the hash and comparing.
 */
export function verifyInvoiceIntegrity(
  payload: InvoiceHashPayload,
  storedHash: string
): boolean {
  return computeInvoiceHash(payload) === storedHash;
}

/**
 * Normalize Decimal/number values to a fixed-precision string.
 * Ensures consistent representation across environments.
 */
function toFixedStr(val: unknown, decimals: number = 2): string {
  if (val === null || val === undefined) return "0.00";
  return Number(val).toFixed(decimals);
}

/**
 * Build hash payload from invoice data (used at creation and verification time).
 * All numeric values are normalized to fixed-precision strings.
 */
export function buildHashPayload(invoice: {
  invoiceNumber: string;
  issueDate: Date | string;
  totalAmount: unknown;
  subtotal: unknown;
  tax: unknown;
  shipping: unknown;
  currency: string;
  exchangeRate: unknown;
  vatRate: unknown;
  isReverseCharge: boolean;
  buyerVatNumber: string | null;
  sellerSnapshot: Record<string, unknown> | null;
  buyerSnapshot: Record<string, unknown> | null;
  lineItemsSnapshot: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string | number;
    total: string | number;
  }> | null;
  previousHash?: string | null;
}): InvoiceHashPayload {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: new Date(invoice.issueDate).toISOString(),
    totalAmount: toFixedStr(invoice.totalAmount),
    subtotal: toFixedStr(invoice.subtotal),
    tax: toFixedStr(invoice.tax),
    shipping: toFixedStr(invoice.shipping),
    currency: invoice.currency,
    exchangeRate: toFixedStr(invoice.exchangeRate, 4),
    vatRate: toFixedStr(invoice.vatRate),
    isReverseCharge: invoice.isReverseCharge,
    buyerVatNumber: invoice.buyerVatNumber,
    sellerSnapshot: (invoice.sellerSnapshot || {}) as Record<string, unknown>,
    buyerSnapshot: (invoice.buyerSnapshot || {}) as Record<string, unknown>,
    lineItems: (invoice.lineItemsSnapshot || []).map((li) => ({
      name: li.name,
      sku: li.sku,
      quantity: li.quantity,
      unitPrice: toFixedStr(li.unitPrice),
      total: toFixedStr(li.total),
    })),
    previousHash: invoice.previousHash ?? null,
  };
}
