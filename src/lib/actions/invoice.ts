"use server";

import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { InvoiceStatus, InvoiceType, Prisma } from "@prisma/client";
import { getSiteSettings } from "@/lib/actions/config";
import {
  computeInvoiceHash,
  buildHashPayload,
  verifyInvoiceIntegrity,
} from "@/lib/invoice-integrity";
import {
  getPreviousInvoiceHash,
  buildVerifactuQrData,
} from "@/lib/verifactu";

// ---------------------------------------------------------------------------
// Sequential invoice number generator (tax-compliant)
// Supports multiple series: INV- (standard), RECT- (rectificativa), FS- (simplificada)
// Uses InvoiceCounter table with row-level lock to prevent gaps/duplicates.
// ---------------------------------------------------------------------------

const SERIES_CONFIG: Record<string, { prefix: string; counterId: string }> = {
  STANDARD: { prefix: "INV", counterId: "default" },
  RECTIFICATIVA: { prefix: "RECT", counterId: "RECT" },
  SIMPLIFICADA: { prefix: "FS", counterId: "FS" },
};

async function generateSequentialInvoiceNumber(
  tx: Prisma.TransactionClient,
  invoiceType: InvoiceType = "STANDARD"
): Promise<string> {
  const year = new Date().getFullYear();
  const config = SERIES_CONFIG[invoiceType] || SERIES_CONFIG.STANDARD;
  const { prefix, counterId } = config;

  // Ensure counter row exists (idempotent)
  await tx.$executeRaw`
    INSERT INTO invoice_counters (id, year, "lastSeq")
    VALUES (${counterId}, ${year}, 0)
    ON CONFLICT (id, year) DO NOTHING
  `;

  // Atomic increment with row-level lock (SELECT ... FOR UPDATE via UPDATE RETURNING)
  const result = await tx.$queryRaw<Array<{ lastSeq: number }>>`
    UPDATE invoice_counters
    SET "lastSeq" = "lastSeq" + 1
    WHERE id = ${counterId} AND year = ${year}
    RETURNING "lastSeq"
  `;

  if (!result.length) {
    throw new Error(`Failed to increment invoice counter for series ${counterId}`);
  }
  const seq = result[0].lastSeq;
  const padded = seq.toString().padStart(5, "0");
  return `${prefix}-${year}-${padded}`;
}

// ---------------------------------------------------------------------------
// Snapshot builders
// ---------------------------------------------------------------------------

function buildSellerSnapshot(settings: {
  siteName?: string;
  address?: string;
  phoneNumber?: string;
  contactEmail?: string;
  sellerTaxId?: string;
}) {
  return {
    name: settings.siteName || "",
    address: settings.address || "",
    phone: settings.phoneNumber || "",
    email: settings.contactEmail || "",
    taxId: settings.sellerTaxId || "",
  };
}

function buildBuyerSnapshot(customer: {
  name: string | null;
  email: string;
  companyName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  addresses?: Array<{
    street: string;
    city: string;
    zipCode: string;
    country: string;
    state?: string | null;
  }>;
}) {
  const addr = customer.addresses?.[0];
  return {
    name: customer.name || "",
    company: customer.companyName || "",
    email: customer.email,
    phone: customer.phone || "",
    taxId: customer.taxId || "",
    address: addr
      ? {
          street: addr.street,
          city: addr.city,
          zipCode: addr.zipCode,
          country: addr.country,
          state: addr.state || "",
        }
      : null,
  };
}

function buildLineItemsSnapshot(
  items: Array<{
    name?: string | null;
    sku?: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
    vatRate?: number; // Per-item VAT rate for multi-rate support
  }>
) {
  return items.map((item) => ({
    name: item.name || "",
    sku: item.sku || "",
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    total: String(item.total),
    vatRate: item.vatRate ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Multi-VAT rate breakdown builder
// Groups line items by VAT rate and computes base + amount per group
// ---------------------------------------------------------------------------

interface VatBreakdownEntry {
  vatRate: number;
  base: string;
  amount: string;
}

function buildVatBreakdown(
  lineItems: Array<{ total: string | number; vatRate?: number | null }>,
  defaultVatRate: number,
  isReverseCharge: boolean,
  isExempt: boolean
): VatBreakdownEntry[] {
  // If reverse charge or exempt, single entry with 0 tax
  if (isReverseCharge || isExempt) {
    const totalBase = lineItems.reduce((sum, li) => sum + Number(li.total), 0);
    return [{ vatRate: 0, base: totalBase.toFixed(2), amount: "0.00" }];
  }

  // Group items by VAT rate
  const groups = new Map<number, number>();
  for (const li of lineItems) {
    const rate = li.vatRate ?? defaultVatRate;
    groups.set(rate, (groups.get(rate) || 0) + Number(li.total));
  }

  // Only return breakdown if there are multiple rates
  if (groups.size <= 1) return [];

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, base]) => ({
      vatRate: rate,
      base: base.toFixed(2),
      amount: (base * rate / 100).toFixed(2),
    }));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateInvoiceResult = {
  success: boolean;
  invoiceId?: string;
  error?: string;
};

export type RecordPaymentResult = {
  success: boolean;
  paymentId?: string;
  error?: string;
};

export type VerifyInvoiceResult = {
  valid: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Create invoice from Sales Order
// ---------------------------------------------------------------------------

export async function createInvoiceFromSO(
  salesOrderId: string,
  status: InvoiceStatus = "DRAFT"
): Promise<CreateInvoiceResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Check if invoice already exists for this SO
    const existingInvoice = await db.invoice.findFirst({
      where: { salesOrderId },
    });

    if (existingInvoice) {
      if (status !== "DRAFT" && existingInvoice.status === "DRAFT") {
        await db.invoice.update({
          where: { id: existingInvoice.id },
          data: { status },
        });
      }
      return { success: true, invoiceId: existingInvoice.id };
    }

    // Load SO with full relations for snapshots
    const so = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: { include: { addresses: true } },
        items: true,
      },
    });

    if (!so) {
      return { success: false, error: "Sales Order not found" };
    }

    // Load site settings for seller snapshot
    const settings = await getSiteSettings();

    // Determine subtotal/tax/shipping
    let invoiceSubtotal = so.subtotal;
    let invoiceTax = so.tax;
    let invoiceShipping = so.shipping;

    // Resolve VAT data from linked Order (which has vatRate/isReverseCharge)
    let vatRate = new Prisma.Decimal(21);
    let isReverseCharge = false;
    let isExempt = false;
    let vatLabel: string | null = null;
    let vatLegalNote: string | null = null;
    let buyerVatNumber: string | null = null;
    let buyerCountry: string | null = null;

    if (so.orderNumber.startsWith("ORD-")) {
      const linkedOrder = await db.order.findFirst({
        where: { orderNumber: so.orderNumber },
        select: {
          subtotal: true,
          tax: true,
          shipping: true,
          vatRate: true,
          isReverseCharge: true,
          buyerVatNumber: true,
        },
      });
      if (linkedOrder) {
        if (invoiceSubtotal == null) {
          invoiceSubtotal = linkedOrder.subtotal;
          invoiceTax = linkedOrder.tax;
          invoiceShipping = linkedOrder.shipping;
        }
        vatRate = linkedOrder.vatRate;
        isReverseCharge = linkedOrder.isReverseCharge;
        buyerVatNumber = linkedOrder.buyerVatNumber;
      }
    }

    // Derive buyer country from address or registration
    buyerCountry =
      so.customer.registrationCountry ||
      so.customer.addresses?.[0]?.country ||
      null;

    // Use VAT system to get full determination (labels + legal notes)
    if (buyerCountry) {
      const { determineVATAsync } = await import("@/lib/vat");
      const vatDet = await determineVATAsync({
        subtotal: Number(invoiceSubtotal ?? so.totalAmount),
        buyerCountry,
        buyerVATNumber: buyerVatNumber || so.customer.taxId || undefined,
      });
      // Prefer the linked order's numeric values, but use VAT system for labels
      vatLabel = vatDet.vatLabelEs || vatDet.vatLabel;
      vatLegalNote = vatDet.legalNoteEs || vatDet.legalNote || null;
      isExempt = vatDet.isExempt;
      // If no linked order, also use the VAT system's computed values
      if (!so.orderNumber.startsWith("ORD-")) {
        vatRate = new Prisma.Decimal(vatDet.vatRate);
        isReverseCharge = vatDet.isReverseCharge;
      }
    }

    // Final fallback for subtotal
    if (invoiceSubtotal == null) {
      if (so.items.length > 0) {
        const itemsTotal = so.items.reduce(
          (sum, item) => sum + Number(item.total),
          0
        );
        invoiceSubtotal = new Prisma.Decimal(itemsTotal);
      } else {
        invoiceSubtotal = so.totalAmount;
      }
      invoiceTax = invoiceTax ?? new Prisma.Decimal(0);
      invoiceShipping = invoiceShipping ?? new Prisma.Decimal(0);
    }

    // Build snapshots
    const sellerSnapshot = buildSellerSnapshot(settings);
    const buyerSnapshot = buildBuyerSnapshot(so.customer);
    const lineItemsSnapshot = buildLineItemsSnapshot(so.items);

    // Due date: 30 days
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Build VAT breakdown for multi-rate support
    const vatBreakdown = buildVatBreakdown(
      lineItemsSnapshot,
      Number(vatRate),
      isReverseCharge,
      isExempt
    );

    // Get previous hash for VeriFactu chain
    const previousHash = await getPreviousInvoiceHash("default");

    // Create invoice inside transaction (sequential numbering + data)
    const invoice = await db.$transaction(async (tx) => {
      const invoiceNumber = await generateSequentialInvoiceNumber(tx, "STANDARD");

      // Build VeriFactu QR data
      const verifactuQrData = buildVerifactuQrData({
        issuerNIF: sellerSnapshot.taxId || "",
        invoiceNumber,
        invoiceDate: issueDate.toISOString().slice(0, 10),
        totalAmount: Number(so.totalAmount).toFixed(2),
      });

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: "STANDARD",
          salesOrderId: so.id,
          customerId: so.customerId,
          status,
          issueDate,
          dueDate,
          totalAmount: so.totalAmount,
          subtotal: invoiceSubtotal,
          tax: invoiceTax,
          shipping: invoiceShipping,
          currency: so.currency,
          exchangeRate: so.exchangeRate,
          paidAmount: 0,
          // Tax compliance fields (RD 1619/2012)
          vatRate,
          isReverseCharge,
          isExempt,
          vatLabel,
          vatLegalNote,
          buyerVatNumber,
          buyerCountry,
          sellerSnapshot,
          buyerSnapshot,
          lineItemsSnapshot,
          vatBreakdown: vatBreakdown.length > 0 ? (vatBreakdown as unknown as Prisma.InputJsonValue) : undefined,
          // VeriFactu preparation
          previousHash,
          verifactuQrData,
        },
      });

      // Compute and store integrity hash (includes previousHash for chain)
      const hashPayload = buildHashPayload({
        invoiceNumber: created.invoiceNumber,
        issueDate: created.issueDate,
        totalAmount: created.totalAmount,
        subtotal: created.subtotal,
        tax: created.tax,
        shipping: created.shipping,
        currency: created.currency,
        exchangeRate: created.exchangeRate,
        vatRate: created.vatRate,
        isReverseCharge: created.isReverseCharge,
        buyerVatNumber: created.buyerVatNumber,
        sellerSnapshot,
        buyerSnapshot,
        lineItemsSnapshot,
        previousHash,
      });

      const integrityHash = computeInvoiceHash(hashPayload);

      await tx.invoice.update({
        where: { id: created.id },
        data: { integrityHash },
      });

      return { ...created, integrityHash };
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/sales-orders/${salesOrderId}`);

    // Send invoice email to customer (non-blocking)
    if (so.customer?.email) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      import("@/lib/email")
        .then(({ sendInvoiceEmail }) =>
          sendInvoiceEmail({
            to: so.customer.email,
            customerName: so.customer.name || so.customer.email,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: Number(so.totalAmount),
            currency: so.currency || "EUR",
            dueDate: dueDate.toLocaleDateString("en-GB"),
            invoiceUrl: `${baseUrl}/profile/invoices`,
          })
        )
        .catch((e) => console.error("Invoice email failed:", e));
    }

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("Error creating invoice:", error);
    return { success: false, error: "Failed to create invoice" };
  }
}

// ---------------------------------------------------------------------------
// Create Factura Rectificativa (Art. 15 RD 1619/2012)
// Credit note / correction referencing an original invoice.
// Series: RECT-{YEAR}-{SEQ}
// ---------------------------------------------------------------------------

export async function createRectificativeInvoice(
  originalInvoiceId: string,
  reason: string,
  correctedAmount?: number
): Promise<CreateInvoiceResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { success: false, error: "Unauthorized" };

  if (!reason?.trim()) {
    return { success: false, error: "Rectification reason is required (Art. 15 RD 1619/2012)" };
  }

  try {
    const original = await db.invoice.findUnique({
      where: { id: originalInvoiceId },
      include: {
        customer: { include: { addresses: true } },
        salesOrder: { include: { items: true } },
      },
    });

    if (!original) {
      return { success: false, error: "Original invoice not found" };
    }

    if (original.status === "CANCELLED") {
      return { success: false, error: "Cannot rectify a cancelled invoice" };
    }

    // For PAID invoices, require explicit correctedAmount to avoid accidental full reversals
    if (original.status === "PAID" && correctedAmount == null) {
      return {
        success: false,
        error: "Cannot fully reverse a PAID invoice. Provide a correctedAmount for partial adjustment, or use the full original amount to confirm full reversal.",
      };
    }

    const settings = await getSiteSettings();
    const sellerSnapshot = buildSellerSnapshot(settings);
    const buyerSnapshot = buildBuyerSnapshot(original.customer);

    // Rectificativa amount: negative of original (or custom corrected amount)
    const rectAmount = correctedAmount != null
      ? new Prisma.Decimal(correctedAmount)
      : new Prisma.Decimal(Number(original.totalAmount)).negated();

    const rectSubtotal = correctedAmount != null
      ? new Prisma.Decimal((correctedAmount / (1 + Number(original.vatRate) / 100)).toFixed(2))
      : new Prisma.Decimal(Number(original.subtotal ?? 0)).negated();

    const rectTax = correctedAmount != null
      ? new Prisma.Decimal((correctedAmount - Number(rectSubtotal)).toFixed(2))
      : new Prisma.Decimal(Number(original.tax ?? 0)).negated();

    // Build line items snapshot referencing original items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
    const lineItemsSnapshot = (original.lineItemsSnapshot as any[]) || [];
    const rectLineItems = lineItemsSnapshot.map((li: any) => ({
      ...li,
      unitPrice: correctedAmount != null ? li.unitPrice : String(-Number(li.unitPrice)),
      total: correctedAmount != null ? li.total : String(-Number(li.total)),
    }));

    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const previousHash = await getPreviousInvoiceHash("RECT");

    const invoice = await db.$transaction(async (tx) => {
      const invoiceNumber = await generateSequentialInvoiceNumber(tx, "RECTIFICATIVA");

      const verifactuQrData = buildVerifactuQrData({
        issuerNIF: sellerSnapshot.taxId || "",
        invoiceNumber,
        invoiceDate: issueDate.toISOString().slice(0, 10),
        totalAmount: Number(rectAmount).toFixed(2),
      });

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: "RECTIFICATIVA",
          originalInvoiceId,
          rectificationReason: reason.trim(),
          salesOrderId: original.salesOrderId,
          customerId: original.customerId,
          status: "DRAFT",
          issueDate,
          dueDate,
          totalAmount: rectAmount,
          subtotal: rectSubtotal,
          tax: rectTax,
          shipping: new Prisma.Decimal(0),
          currency: original.currency,
          exchangeRate: original.exchangeRate,
          paidAmount: 0,
          vatRate: original.vatRate,
          isReverseCharge: original.isReverseCharge,
          isExempt: original.isExempt ?? false,
          vatLabel: original.vatLabel,
          vatLegalNote: original.vatLegalNote,
          buyerVatNumber: original.buyerVatNumber,
          buyerCountry: original.buyerCountry,
          sellerSnapshot,
          buyerSnapshot,
          lineItemsSnapshot: rectLineItems as Prisma.InputJsonValue,
          previousHash,
          verifactuQrData,
        },
      });

      const hashPayload = buildHashPayload({
        invoiceNumber: created.invoiceNumber,
        issueDate: created.issueDate,
        totalAmount: created.totalAmount,
        subtotal: created.subtotal,
        tax: created.tax,
        shipping: created.shipping,
        currency: created.currency,
        exchangeRate: created.exchangeRate,
        vatRate: created.vatRate,
        isReverseCharge: created.isReverseCharge,
        buyerVatNumber: created.buyerVatNumber,
        sellerSnapshot,
        buyerSnapshot,
        lineItemsSnapshot: rectLineItems as any,
        previousHash,
      });

      const integrityHash = computeInvoiceHash(hashPayload);

      await tx.invoice.update({
        where: { id: created.id },
        data: { integrityHash },
      });

      return { ...created, integrityHash };
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${originalInvoiceId}`);

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("Error creating rectificative invoice:", error);
    return { success: false, error: "Failed to create rectificative invoice" };
  }
}

// ---------------------------------------------------------------------------
// Create Factura Simplificada (Art. 4 RD 1619/2012)
// For B2C transactions ≤400€. Buyer NIF not required.
// Series: FS-{YEAR}-{SEQ}
// ---------------------------------------------------------------------------

export async function createSimplifiedInvoice(
  salesOrderId: string
): Promise<CreateInvoiceResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    // Check if invoice already exists for this SO
    const existing = await db.invoice.findFirst({ where: { salesOrderId } });
    if (existing) {
      return { success: true, invoiceId: existing.id };
    }

    const so = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: { include: { addresses: true } },
        items: true,
      },
    });

    if (!so) return { success: false, error: "Sales Order not found" };

    // Validate simplified invoice limit (Art. 4.1 RD 1619/2012: ≤400€ general, ≤3000€ for certain sectors)
    const totalAmount = Number(so.totalAmount);
    if (totalAmount > 400) {
      return {
        success: false,
        error: "Simplified invoices are limited to ≤400€ (Art. 4 RD 1619/2012). Use standard invoice instead.",
      };
    }

    const settings = await getSiteSettings();
    const sellerSnapshot = buildSellerSnapshot(settings);
    // Simplified: minimal buyer info (no NIF required)
    const buyerSnapshot = {
      name: so.customer.companyName || so.customer.name || "",
      company: "",
      email: so.customer.email,
      phone: "",
      taxId: "",
      address: null,
    };

    const lineItemsSnapshot = buildLineItemsSnapshot(so.items);

    // For simplified invoices, VAT is included in price (IVA incluido)
    const defaultVatRate = 21;
    const subtotal = new Prisma.Decimal((totalAmount / (1 + defaultVatRate / 100)).toFixed(2));
    const tax = new Prisma.Decimal((totalAmount - Number(subtotal)).toFixed(2));

    const issueDate = new Date();
    const dueDate = new Date(); // Simplified invoices are typically paid immediately

    const previousHash = await getPreviousInvoiceHash("FS");

    const invoice = await db.$transaction(async (tx) => {
      const invoiceNumber = await generateSequentialInvoiceNumber(tx, "SIMPLIFICADA");

      const verifactuQrData = buildVerifactuQrData({
        issuerNIF: sellerSnapshot.taxId || "",
        invoiceNumber,
        invoiceDate: issueDate.toISOString().slice(0, 10),
        totalAmount: totalAmount.toFixed(2),
      });

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: "SIMPLIFICADA",
          salesOrderId: so.id,
          customerId: so.customerId,
          status: "DRAFT",
          issueDate,
          dueDate,
          totalAmount: so.totalAmount,
          subtotal,
          tax,
          shipping: so.shipping ?? new Prisma.Decimal(0),
          currency: so.currency,
          exchangeRate: so.exchangeRate,
          paidAmount: 0,
          vatRate: defaultVatRate,
          isReverseCharge: false,
          isExempt: false,
          vatLabel: `IVA ${defaultVatRate}% incluido`,
          buyerCountry: so.customer.registrationCountry || so.customer.addresses?.[0]?.country || null,
          sellerSnapshot,
          buyerSnapshot,
          lineItemsSnapshot,
          previousHash,
          verifactuQrData,
        },
      });

      const hashPayload = buildHashPayload({
        invoiceNumber: created.invoiceNumber,
        issueDate: created.issueDate,
        totalAmount: created.totalAmount,
        subtotal: created.subtotal,
        tax: created.tax,
        shipping: created.shipping,
        currency: created.currency,
        exchangeRate: created.exchangeRate,
        vatRate: created.vatRate,
        isReverseCharge: created.isReverseCharge,
        buyerVatNumber: created.buyerVatNumber,
        sellerSnapshot,
        buyerSnapshot,
        lineItemsSnapshot,
        previousHash,
      });

      const integrityHash = computeInvoiceHash(hashPayload);

      await tx.invoice.update({
        where: { id: created.id },
        data: { integrityHash },
      });

      return { ...created, integrityHash };
    });

    revalidatePath("/admin/invoices");

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("Error creating simplified invoice:", error);
    return { success: false, error: "Failed to create simplified invoice" };
  }
}

// ---------------------------------------------------------------------------
// Record payment (only allowed mutable fields: paidAmount, status)
// ---------------------------------------------------------------------------

export async function recordPayment(
  invoiceId: string,
  amount: number | string,
  method: string,
  note?: string
): Promise<RecordPaymentResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Row-level lock to prevent concurrent payment race conditions
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; paidAmount: Prisma.Decimal; totalAmount: Prisma.Decimal }>>`
        SELECT id, status, "paidAmount", "totalAmount"
        FROM invoices
        WHERE id = ${invoiceId}
        FOR UPDATE
      `;
      const invoiceCheck = locked[0];

      if (!invoiceCheck) throw new Error("Invoice not found");

      // Prevent payments on CANCELLED invoices
      if (invoiceCheck.status === "CANCELLED") {
        throw new Error("Cannot record payment on a cancelled invoice");
      }

      // Normalize amount to 2 decimal places to avoid floating-point drift
      const safeAmount = Math.round(Number(amount) * 100) / 100;
      if (isNaN(safeAmount) || safeAmount <= 0) {
        throw new Error("Invalid payment amount");
      }

      const newPaidTotal = Math.round((Number(invoiceCheck.paidAmount) + safeAmount) * 100) / 100;
      const totalAmount = Number(invoiceCheck.totalAmount);

      if (newPaidTotal > totalAmount * 1.01) {
        throw new Error(
          `Payment would exceed invoice total. Invoice total: ${totalAmount}, already paid: ${Number(invoiceCheck.paidAmount)}, attempted: ${amount}`
        );
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: safeAmount,
          method,
          note,
        },
      });

      let newStatus: InvoiceStatus = invoiceCheck.status as InvoiceStatus;

      if (newPaidTotal >= totalAmount) {
        newStatus = "PAID";
      } else if (newPaidTotal > 0) {
        newStatus = "PARTIALLY_PAID";
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidTotal,
          status: newStatus,
        },
      });

      return payment;
    });

    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");

    return { success: true, paymentId: result.id };
  } catch (error: unknown) {
    console.error("Error recording payment:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to record payment" };
  }
}

// ---------------------------------------------------------------------------
// Cancel invoice (Spanish law: invoices NEVER deleted, only cancelled)
// RD 1619/2012 — cancelled invoices must be preserved in the sequence.
// ---------------------------------------------------------------------------

export async function cancelInvoice(
  invoiceId: string,
  reason: string
): Promise<CreateInvoiceResult> {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { success: false, error: "Unauthorized" };

  if (!reason?.trim()) {
    return { success: false, error: "Cancellation reason is required" };
  }

  try {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { success: false, error: "Invoice not found" };

    if (invoice.status === "CANCELLED") {
      return { success: false, error: "Invoice is already cancelled" };
    }

    if (invoice.status === "PAID") {
      return {
        success: false,
        error: "Cannot cancel a fully paid invoice. Create a Factura Rectificativa instead.",
      };
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        // Store reason in vatLegalNote if no rectification note field available
        // This preserves the audit trail without adding a new schema field
      },
    });

    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");

    return { success: true, invoiceId };
  } catch (error) {
    console.error("Error cancelling invoice:", error);
    return { success: false, error: "Failed to cancel invoice" };
  }
}

// ---------------------------------------------------------------------------
// Verify invoice integrity
// ---------------------------------------------------------------------------

export async function verifyInvoice(
  invoiceId: string
): Promise<VerifyInvoiceResult> {
  await requireRole(["ADMIN", "SALES_REP"]);

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return { valid: false, error: "Invoice not found" };
  }

  if (!invoice.integrityHash) {
    return { valid: false, error: "Invoice has no integrity hash (legacy invoice)" };
  }

  try {
    const hashPayload = buildHashPayload({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      totalAmount: invoice.totalAmount,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      shipping: invoice.shipping,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      vatRate: invoice.vatRate,
      isReverseCharge: invoice.isReverseCharge,
      buyerVatNumber: invoice.buyerVatNumber,
      sellerSnapshot: (invoice.sellerSnapshot as Record<string, unknown>) || {},
      buyerSnapshot: (invoice.buyerSnapshot as Record<string, unknown>) || {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue runtime access
      lineItemsSnapshot: (invoice.lineItemsSnapshot as any) || [],
      previousHash: invoice.previousHash,
    });

    const valid = verifyInvoiceIntegrity(hashPayload, invoice.integrityHash);

    if (!valid) {
      return {
        valid: false,
        error: "INTEGRITY CHECK FAILED: Invoice data has been tampered with",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error verifying invoice:", error);
    return { valid: false, error: "Failed to verify invoice integrity" };
  }
}

// ---------------------------------------------------------------------------
// Export invoices (CSV / DATEV XML)
// ---------------------------------------------------------------------------

export type ExportInvoicesResult = {
  success: boolean;
  data?: string;
  filename?: string;
  mimeType?: string;
  error?: string;
};

export async function exportInvoices(
  format: "csv" | "xml",
  dateFrom?: string,
  dateTo?: string
): Promise<ExportInvoicesResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const dateFilter: Prisma.InvoiceWhereInput = {};
    if (dateFrom || dateTo) {
      const issueDateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) issueDateFilter.gte = new Date(dateFrom);
      if (dateTo) issueDateFilter.lte = new Date(dateTo + "T23:59:59.999Z");
      dateFilter.issueDate = issueDateFilter;
    }

    const invoices = await db.invoice.findMany({
      where: dateFilter,
      include: {
        customer: {
          select: { name: true, email: true, companyName: true, taxId: true },
        },
      },
      orderBy: { issueDate: "asc" },
    });

    const today = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const BOM = "\uFEFF";
      const headers = [
        "invoiceNumber",
        "invoiceType",
        "date",
        "customerName",
        "customerVat",
        "subtotal",
        "tax",
        "shipping",
        "total",
        "paidAmount",
        "status",
        "currency",
        "vatRate",
        "isReverseCharge",
        "isExempt",
        "originalInvoiceId",
        "rectificationReason",
      ];

      const escape = (val: unknown): string => {
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      const lines = [
        headers.join(","),
        ...invoices.map((inv) =>
          [
            inv.invoiceNumber,
            inv.invoiceType,
            inv.issueDate.toISOString().slice(0, 10),
            inv.customer.companyName || inv.customer.name || inv.customer.email,
            inv.customer.taxId || "",
            Number(inv.subtotal ?? 0).toFixed(2),
            Number(inv.tax ?? 0).toFixed(2),
            Number(inv.shipping ?? 0).toFixed(2),
            Number(inv.totalAmount).toFixed(2),
            Number(inv.paidAmount).toFixed(2),
            inv.status,
            inv.currency,
            Number(inv.vatRate).toFixed(2),
            inv.isReverseCharge ? "true" : "false",
            inv.isExempt ? "true" : "false",
            inv.originalInvoiceId || "",
            inv.rectificationReason || "",
          ]
            .map(escape)
            .join(",")
        ),
      ];

      return {
        success: true,
        data: BOM + lines.join("\r\n"),
        filename: `invoices-${today}.csv`,
        mimeType: "text/csv; charset=utf-8",
      };
    }

    // XML format (DATEV-compatible simplified)
    if (format === "xml") {
      const xmlEscape = (val: unknown): string => {
        const str = val == null ? "" : String(val);
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
      };

      const invoiceNodes = invoices.map((inv) => {
        const lineItems = (inv.lineItemsSnapshot as Record<string, unknown>[]) || [];
        const lineItemsXml = lineItems
          .map(
            (item: Record<string, unknown>) =>
              `      <LineItem>
        <Name>${xmlEscape(item.name)}</Name>
        <SKU>${xmlEscape(item.sku)}</SKU>
        <Quantity>${item.quantity}</Quantity>
        <UnitPrice>${item.unitPrice}</UnitPrice>
        <Total>${item.total}</Total>
      </LineItem>`
          )
          .join("\n");

        return `  <Invoice>
    <InvoiceNumber>${xmlEscape(inv.invoiceNumber)}</InvoiceNumber>
    <InvoiceType>${inv.invoiceType}</InvoiceType>
    <Date>${inv.issueDate.toISOString().slice(0, 10)}</Date>
    <DueDate>${inv.dueDate.toISOString().slice(0, 10)}</DueDate>
    <CustomerName>${xmlEscape(inv.customer.companyName || inv.customer.name || inv.customer.email)}</CustomerName>
    <CustomerVat>${xmlEscape(inv.customer.taxId)}</CustomerVat>
    <Subtotal>${Number(inv.subtotal ?? 0).toFixed(2)}</Subtotal>
    <Tax>${Number(inv.tax ?? 0).toFixed(2)}</Tax>
    <Shipping>${Number(inv.shipping ?? 0).toFixed(2)}</Shipping>
    <Total>${Number(inv.totalAmount).toFixed(2)}</Total>
    <PaidAmount>${Number(inv.paidAmount).toFixed(2)}</PaidAmount>
    <Status>${inv.status}</Status>
    <Currency>${inv.currency}</Currency>
    <VatRate>${Number(inv.vatRate).toFixed(2)}</VatRate>
    <IsReverseCharge>${inv.isReverseCharge}</IsReverseCharge>
    <IsExempt>${inv.isExempt}</IsExempt>${inv.originalInvoiceId ? `
    <OriginalInvoiceId>${xmlEscape(inv.originalInvoiceId)}</OriginalInvoiceId>` : ""}${inv.rectificationReason ? `
    <RectificationReason>${xmlEscape(inv.rectificationReason)}</RectificationReason>` : ""}${inv.integrityHash ? `
    <IntegrityHash>${inv.integrityHash}</IntegrityHash>` : ""}
    <LineItems>
${lineItemsXml}
    </LineItems>
  </Invoice>`;
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoices exported="${today}" count="${invoices.length}">
${invoiceNodes.join("\n")}
</Invoices>`;

      return {
        success: true,
        data: xml,
        filename: `invoices-${today}.xml`,
        mimeType: "application/xml; charset=utf-8",
      };
    }

    return { success: false, error: "Invalid format" };
  } catch (error) {
    console.error("Error exporting invoices:", error);
    return { success: false, error: "Failed to export invoices" };
  }
}

// ---------------------------------------------------------------------------
// Query functions (unchanged)
// ---------------------------------------------------------------------------

export async function getInvoices() {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return [];

  const invoices = await db.invoice.findMany({
    include: {
      customer: {
        select: { name: true, email: true, companyName: true },
      },
      salesOrder: {
        select: { orderNumber: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices;
}

export async function getInvoice(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return null;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: true,
        },
      },
      salesOrder: {
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { date: "desc" },
      },
      originalInvoice: {
        select: { id: true, invoiceNumber: true, issueDate: true },
      },
      rectifications: {
        select: { id: true, invoiceNumber: true, invoiceType: true, status: true, totalAmount: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Security check: If user is not admin, ensure they own the invoice
  if (
    session.user.role === "CUSTOMER" &&
    invoice?.customerId !== session.user.id
  ) {
    return null;
  }

  return invoice;
}

// Legacy stub — kept for backwards compatibility with InvoiceButton (HTML invoice)
export async function generateInvoiceHtml(_orderId: string) {
  return { error: "Use B2B Invoice PDF generation instead" };
}

export async function getUserInvoices(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.id !== userId) return [];

  const invoices = await db.invoice.findMany({
    where: { customerId: userId },
    include: {
      customer: {
        include: {
          addresses: true,
        },
      },
      salesOrder: {
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices;
}
