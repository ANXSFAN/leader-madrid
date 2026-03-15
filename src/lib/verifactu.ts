/**
 * VeriFactu preparation module (Ley 11/2021 — Sistema de Emisión de Facturas Verificables)
 *
 * This module contains data structures, QR generation helpers, and placeholder
 * functions for future AEAT SII/VeriFactu API integration.
 *
 * Current status: PREPARATION ONLY — no live AEAT calls.
 */

import db from "@/lib/db";

// ---------------------------------------------------------------------------
// VeriFactu Registration Record (Art. 12 RD 1007/2023)
// ---------------------------------------------------------------------------

export interface VeriFactuRegistrationRecord {
  // Identification
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceType: "F1" | "F2" | "R1" | "R2" | "R3" | "R4" | "R5";
  // F1 = Factura, F2 = Factura Simplificada
  // R1 = Rectificativa (art. 80.1/80.2/80.6), R2 = Rectificativa (art. 80.3)
  // R3 = Rectificativa (art. 80.4), R4 = Rectificativa others, R5 = Facturas simplificadas rectificativas

  // Issuer
  issuerNIF: string;
  issuerName: string;

  // Recipient (not required for simplificadas <400€)
  recipientNIF?: string;
  recipientName?: string;

  // Financial
  totalAmount: string; // Decimal as string
  taxBreakdown: VeriFactuTaxBreakdown[];

  // Chain integrity
  integrityHash: string;
  previousHash: string | null;

  // Reference to original invoice (for rectificativas)
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
  rectificationReason?: string;

  // System metadata
  softwareName: string;
  softwareVersion: string;
  softwareNIF: string; // NIF of the software developer
}

export interface VeriFactuTaxBreakdown {
  taxType: "IVA" | "IGIC"; // IVA for peninsula, IGIC for Canaries
  vatRate: string; // e.g. "21.00"
  taxableBase: string; // Base imponible
  taxAmount: string; // Cuota
  isReverseCharge?: boolean;
  isExempt?: boolean;
  exemptionCause?: string; // Art. 20/21/22/24/25 LIVA
}

// ---------------------------------------------------------------------------
// QR Code data builder (Art. 14 RD 1007/2023)
// ---------------------------------------------------------------------------

/**
 * Build the URL/data string for the VeriFactu QR code.
 * Format: https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=X&numserie=Y&fecha=Z&importe=W
 *
 * NOTE: This is the expected production URL structure. The actual URL may change
 * when AEAT publishes the final VeriFactu specification.
 */
export function buildVerifactuQrData(params: {
  issuerNIF: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: string;
}): string {
  const baseUrl =
    "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR";
  const searchParams = new URLSearchParams({
    nif: params.issuerNIF,
    numserie: params.invoiceNumber,
    fecha: params.invoiceDate,
    importe: params.totalAmount,
  });
  return `${baseUrl}?${searchParams.toString()}`;
}

// ---------------------------------------------------------------------------
// Chain hash: get the previous invoice's hash for chaining
// ---------------------------------------------------------------------------

/**
 * Retrieve the hash of the most recent invoice for chain integrity.
 * VeriFactu requires each invoice hash to include the previous invoice's hash,
 * creating an unbroken chain that prevents tampering.
 *
 * @param series - The invoice counter series ("default", "RECT", "FS")
 */
export async function getPreviousInvoiceHash(
  series: string = "default"
): Promise<string | null> {
  // Map series to invoice number prefix
  const prefixMap: Record<string, string> = {
    default: "INV-",
    RECT: "RECT-",
    FS: "FS-",
  };
  const prefix = prefixMap[series] || "INV-";

  const lastInvoice = await db.invoice.findFirst({
    where: {
      invoiceNumber: { startsWith: prefix },
      integrityHash: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { integrityHash: true },
  });

  return lastInvoice?.integrityHash ?? null;
}

// ---------------------------------------------------------------------------
// Map internal invoice type to VeriFactu type code
// ---------------------------------------------------------------------------

export function mapInvoiceTypeToVerifactu(
  invoiceType: string,
  isRectificativa: boolean = false
): "F1" | "F2" | "R1" | "R4" | "R5" {
  if (invoiceType === "SIMPLIFICADA") {
    return isRectificativa ? "R5" : "F2";
  }
  if (invoiceType === "RECTIFICATIVA") {
    return "R1"; // Default to R1 (art. 80.1/80.2/80.6); could be R2-R4 based on reason
  }
  return "F1"; // STANDARD
}

// ---------------------------------------------------------------------------
// Build VeriFactu registration record from invoice data
// ---------------------------------------------------------------------------

export function buildRegistrationRecord(invoice: {
  invoiceNumber: string;
  issueDate: Date | string;
  invoiceType: string;
  totalAmount: unknown;
  sellerSnapshot: Record<string, string> | null;
  buyerSnapshot: Record<string, string> | null;
  vatRate: unknown;
  tax: unknown;
  subtotal: unknown;
  isReverseCharge: boolean;
  isExempt: boolean;
  integrityHash: string;
  previousHash: string | null;
  originalInvoice?: { invoiceNumber: string; issueDate: Date | string } | null;
  rectificationReason?: string | null;
  vatBreakdown?: Array<{ vatRate: number; base: string; amount: string }> | null;
}): VeriFactuRegistrationRecord {
  const seller = invoice.sellerSnapshot || {};
  const buyer = invoice.buyerSnapshot || {};

  // Build tax breakdown
  let taxBreakdown: VeriFactuTaxBreakdown[];

  if (invoice.vatBreakdown && invoice.vatBreakdown.length > 0) {
    // Multi-rate: use detailed breakdown
    taxBreakdown = invoice.vatBreakdown.map((b) => ({
      taxType: "IVA" as const,
      vatRate: Number(b.vatRate).toFixed(2),
      taxableBase: b.base,
      taxAmount: b.amount,
      isReverseCharge: invoice.isReverseCharge,
      isExempt: invoice.isExempt,
    }));
  } else {
    // Single rate
    taxBreakdown = [
      {
        taxType: "IVA" as const,
        vatRate: Number(invoice.vatRate).toFixed(2),
        taxableBase: Number(invoice.subtotal ?? 0).toFixed(2),
        taxAmount: Number(invoice.tax ?? 0).toFixed(2),
        isReverseCharge: invoice.isReverseCharge,
        isExempt: invoice.isExempt,
      },
    ];
  }

  const record: VeriFactuRegistrationRecord = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: new Date(invoice.issueDate).toISOString().slice(0, 10),
    invoiceType: mapInvoiceTypeToVerifactu(invoice.invoiceType),
    issuerNIF: seller.taxId || "",
    issuerName: seller.name || "",
    recipientNIF: buyer.taxId || undefined,
    recipientName: buyer.company || buyer.name || undefined,
    totalAmount: Number(invoice.totalAmount).toFixed(2),
    taxBreakdown,
    integrityHash: invoice.integrityHash,
    previousHash: invoice.previousHash,
    softwareName: "MyLED ERP",
    softwareVersion: "1.0.0",
    softwareNIF: seller.taxId || "", // In production, this should be the developer's NIF
  };

  // Rectificativa references
  if (invoice.originalInvoice) {
    record.originalInvoiceNumber = invoice.originalInvoice.invoiceNumber;
    record.originalInvoiceDate = new Date(invoice.originalInvoice.issueDate)
      .toISOString()
      .slice(0, 10);
    record.rectificationReason = invoice.rectificationReason || undefined;
  }

  return record;
}

// ---------------------------------------------------------------------------
// Placeholder: Submit to AEAT (future implementation)
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER: Submit a VeriFactu registration record to AEAT.
 * This function will be implemented when the AEAT VeriFactu API is available.
 *
 * @returns The VeriFactu registration ID assigned by AEAT
 */
export async function submitToAEAT(
  _record: VeriFactuRegistrationRecord
): Promise<{ success: boolean; verifactuId?: string; error?: string }> {
  // TODO: Implement when AEAT VeriFactu API credentials are available
  // The API endpoint will be something like:
  // Production: https://www1.agenciatributaria.gob.es/wlpl/SSII-FACT/ws/fe/SiiFactFEV1SOAP
  // Test: https://www7.aeat.es/wlpl/SSII-FACT/ws/fe/SiiFactFEV1SOAP
  console.warn("[VeriFactu] submitToAEAT called but not yet implemented");
  return {
    success: false,
    error: "VeriFactu AEAT API not yet configured",
  };
}
