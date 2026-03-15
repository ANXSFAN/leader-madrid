import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import {
  Invoice,
  SalesOrder,
  SalesOrderItem,
  ProductVariant,
  Product,
  User,
  Address,
} from "@prisma/client";
import { SiteSettingsData } from "@/lib/actions/config";
import { getItemProductName, getItemSku } from "@/lib/utils/product-snapshot";

// Centralised label dictionary — bilingual ES/EN for Spanish tax compliance
const LABELS = {
  invoice_title: "FACTURA / INVOICE",
  rectificativa_title: "FACTURA RECTIFICATIVA / CREDIT NOTE",
  simplificada_title: "FACTURA SIMPLIFICADA / SIMPLIFIED INVOICE",
  invoice_no: "Nº Factura / Invoice No:",
  date: "Fecha emisión / Issue date:",
  due_date: "Fecha vencimiento / Due date:",
  operation_date: "Fecha operación / Operation date:",
  bill_to: "DATOS DEL CLIENTE / BILL TO:",
  from: "DATOS DEL EMISOR / FROM:",
  order_ref: "Ref. Pedido / Order Ref:",
  payment_method: "Forma de pago / Payment method:",
  col_description: "Descripción / Description",
  col_qty: "Ud.",
  col_unit_price: "Precio/Ud.",
  col_total: "Importe",
  subtotal: "Base Imponible / Subtotal:",
  shipping: "Gastos de envío / Shipping:",
  vat_label: (pct: number) => `IVA ${pct}%:`,
  vat_reverse: "IVA – Inversión del Sujeto Pasivo:",
  grand_total: "TOTAL FACTURA:",
  paid: "Pagado / Paid:",
  balance: "Saldo Pendiente / Balance:",
  reverse_charge_note:
    "Operación sujeta a inversión del sujeto pasivo conforme al art. 84.Uno.2º de la Ley 37/1992 del IVA y art. 194 de la Directiva 2006/112/CE. El destinatario es sujeto pasivo del IVA.",
  thank_you: "Gracias por su confianza / Thank you for your business",
  vat_id: "NIF/CIF/VAT:",
  nif: "NIF/CIF:",
  legal_name: "Razón Social:",
  guest: "Cliente sin registrar",
  integrity: "Hash de integridad:",
  page_of: (n: number, total: number) => `Página ${n} de ${total}`,
  rectifies: "Rectifica factura / Corrects invoice:",
  rectification_reason: "Motivo / Reason:",
  vat_included: "IVA incluido / VAT included",
  vat_breakdown_title: "Desglose IVA / VAT Breakdown:",
  vat_base: "Base",
  vat_amount: "Cuota",
  verifactu: "VeriFactu:",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#333333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  companyInfo: {
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  addressBox: {
    width: "45%",
  },
  label: {
    fontSize: 8,
    color: "#888888",
    marginBottom: 2,
    fontWeight: "bold",
  },
  text: {
    marginBottom: 2,
    lineHeight: 1.4,
  },
  orderInfo: {
    width: "45%",
    textAlign: "right",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    padding: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    padding: 8,
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  bold: { fontWeight: "bold" },
  totals: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 30,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginBottom: 5,
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 5,
    marginTop: 5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#888888",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 10,
  },
});

// Snapshot types
interface SellerSnapshot {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

interface BuyerSnapshot {
  name: string;
  company: string;
  email: string;
  phone: string;
  taxId: string;
  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
    state: string;
  } | null;
}

interface LineItemSnapshot {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export type InvoiceWithRelations = Invoice & {
  customer: User & {
    addresses?: Address[];
  };
  salesOrder: SalesOrder & {
    items: (SalesOrderItem & {
      variant: ProductVariant & {
        product: Product;
      };
    })[];
  };
  originalInvoice?: Invoice | null;
};

interface InvoicePDFProps {
  invoice: InvoiceWithRelations;
  settings: SiteSettingsData;
  locale?: string;
  qrCodeDataUrl?: string; // Pre-generated QR code as data:image/png;base64,...
}

export default function InvoicePDF({ invoice, settings, locale = "en", qrCodeDataUrl }: InvoicePDFProps) {
  const currency = invoice.currency || settings.currency || "EUR";

  const formatCurrency = (amount: number | string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(Number(amount));

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Use snapshots if available, fall back to live data for legacy invoices
  const sellerSnap = invoice.sellerSnapshot as SellerSnapshot | null;
  const buyerSnap = invoice.buyerSnapshot as BuyerSnapshot | null;
  const lineSnap = invoice.lineItemsSnapshot as LineItemSnapshot[] | null;
  const hasSnapshots = !!sellerSnap && !!buyerSnap && !!lineSnap;

  // Seller info
  const sellerName = sellerSnap?.name || settings.siteName || "";
  const sellerAddress = sellerSnap?.address || settings.address || "";
  const sellerPhone = sellerSnap?.phone || settings.phoneNumber || "";
  const sellerEmail = sellerSnap?.email || settings.contactEmail || "";
  const sellerTaxId = sellerSnap?.taxId || settings.sellerTaxId || "";

  // Buyer info
  const buyerName = buyerSnap?.company || buyerSnap?.name ||
    invoice.customer.companyName || invoice.customer.name || LABELS.guest;
  const buyerTaxId = buyerSnap?.taxId || invoice.customer.taxId || "";
  const buyerEmail = buyerSnap?.email || invoice.customer.email || "";
  const buyerPhone = buyerSnap?.phone || invoice.customer.phone || "";
  const buyerAddress = buyerSnap?.address;
  const liveBuyerAddress = invoice.customer.addresses?.[0];

  // Line items: prefer snapshot
  const displayItems = lineSnap
    ? lineSnap.map((li, idx) => ({
        id: `snap-${idx}`,
        name: li.name,
        sku: li.sku,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
        total: Number(li.total),
      }))
    : invoice.salesOrder.items.map((item) => ({
        id: item.id,
        name: getItemProductName(item, locale),
        sku: getItemSku(item),
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      }));

  // Invoice type
  const invoiceType = invoice.invoiceType || "STANDARD";
  const isRectificativa = invoiceType === "RECTIFICATIVA";
  const isSimplificada = invoiceType === "SIMPLIFICADA";
  const originalInvoice = invoice.originalInvoice as { invoiceNumber: string } | null;
  const rectificationReason = invoice.rectificationReason as string | null;

  // Financial data from invoice (already frozen at creation time)
  const subtotal = Number(invoice.subtotal ?? 0);
  const tax = Number(invoice.tax ?? 0);
  const shipping = Number(invoice.shipping ?? 0);
  const total = Number(invoice.totalAmount);
  const vatRate = Number(invoice.vatRate ?? 21);
  const isRC = invoice.isReverseCharge;
  const isExempt = invoice.isExempt ?? false;
  const vatLabel = invoice.vatLabel as string | null;
  const vatLegalNote = invoice.vatLegalNote as string | null;

  // Multi-VAT rate breakdown
  const vatBreakdown = invoice.vatBreakdown as Array<{
    vatRate: number;
    base: string;
    amount: string;
  }> | null;
  const hasMultiVat = vatBreakdown && vatBreakdown.length > 1;

  // VeriFactu QR data
  const verifactuQrData = invoice.verifactuQrData as string | null;

  // Operation date (delivery/service date) — use SO createdAt if different from invoice date
  const operationDate = invoice.salesOrder.createdAt;
  const showOperationDate =
    operationDate &&
    new Date(operationDate).toDateString() !== new Date(invoice.issueDate).toDateString();

  // Payment method from sales order
  const paymentMethod = (invoice.salesOrder as SalesOrder & { paymentMethod?: string }).paymentMethod || "";

  const renderAddress = (addr: { street: string; city: string; zipCode: string; country: string; state?: string }) => (
    <View style={{ marginTop: 3 }}>
      <Text style={styles.text}>{addr.street}</Text>
      <Text style={styles.text}>
        {addr.zipCode} {addr.city}
        {addr.state ? `, ${addr.state}` : ""}
      </Text>
      <Text style={styles.text}>{addr.country}</Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header — Seller info (left) + Invoice meta (right) */}
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>{LABELS.from}</Text>
            <Text style={styles.companyName}>{sellerName}</Text>
            <Text style={styles.text}>{sellerAddress}</Text>
            <Text style={styles.text}>Tel: {sellerPhone}</Text>
            <Text style={styles.text}>{sellerEmail}</Text>
            {sellerTaxId && (
              <Text style={[styles.text, styles.bold]}>{LABELS.nif} {sellerTaxId}</Text>
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.title}>
              {isRectificativa
                ? LABELS.rectificativa_title
                : isSimplificada
                  ? LABELS.simplificada_title
                  : LABELS.invoice_title}
            </Text>
            <Text style={styles.text}>{LABELS.invoice_no} {invoice.invoiceNumber}</Text>
            <Text style={styles.text}>
              {LABELS.date} {formatDate(invoice.issueDate)}
            </Text>
            {showOperationDate && (
              <Text style={styles.text}>
                {LABELS.operation_date} {formatDate(operationDate)}
              </Text>
            )}
            <Text style={styles.text}>
              {LABELS.due_date} {formatDate(invoice.dueDate)}
            </Text>
            {paymentMethod && (
              <Text style={styles.text}>
                {LABELS.payment_method} {paymentMethod}
              </Text>
            )}
            {isRectificativa && originalInvoice && (
              <Text style={[styles.text, { marginTop: 4, color: "#dc2626" }]}>
                {LABELS.rectifies} {originalInvoice.invoiceNumber}
              </Text>
            )}
            {isRectificativa && rectificationReason && (
              <Text style={[styles.text, { fontSize: 8, color: "#dc2626" }]}>
                {LABELS.rectification_reason} {rectificationReason}
              </Text>
            )}
          </View>
        </View>

        {/* Buyer Section + Order Ref */}
        <View style={styles.section}>
          <View style={styles.addressBox}>
            <Text style={styles.label}>{LABELS.bill_to}</Text>
            <Text style={[styles.text, styles.bold]}>{buyerName}</Text>
            {buyerTaxId && (
              <Text style={[styles.text, styles.bold]}>{LABELS.vat_id} {buyerTaxId}</Text>
            )}
            <Text style={styles.text}>{buyerEmail}</Text>
            {buyerPhone && <Text style={styles.text}>Tel: {buyerPhone}</Text>}

            {buyerAddress
              ? renderAddress(buyerAddress)
              : liveBuyerAddress
                ? renderAddress({
                    street: liveBuyerAddress.street,
                    city: liveBuyerAddress.city,
                    zipCode: liveBuyerAddress.zipCode,
                    country: liveBuyerAddress.country,
                    state: liveBuyerAddress.state ?? undefined,
                  })
                : null}
          </View>

          <View style={styles.orderInfo}>
            <Text style={styles.label}>{LABELS.order_ref}</Text>
            <Text style={styles.text}>{invoice.salesOrder.orderNumber}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Moneda / Currency:</Text>
            <Text style={styles.text}>{currency}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.bold]}>{LABELS.col_description}</Text>
            <Text style={[styles.colQty, styles.bold]}>{LABELS.col_qty}</Text>
            <Text style={[styles.colPrice, styles.bold]}>{LABELS.col_unit_price}</Text>
            <Text style={[styles.colTotal, styles.bold]}>{LABELS.col_total}</Text>
          </View>

          {displayItems.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.colDesc}>
                <Text>{item.name}</Text>
                {item.sku && (
                  <Text style={{ fontSize: 8, color: "#888888" }}>SKU: {item.sku}</Text>
                )}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals — RD 1619/2012 Art.6: base imponible, tipo IVA, cuota IVA */}
        <View style={styles.totals}>
          <View>
            <View style={styles.totalRow}>
              <Text style={styles.text}>{LABELS.subtotal}</Text>
              <Text style={styles.text}>{formatCurrency(subtotal)}</Text>
            </View>

            {shipping > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{LABELS.shipping}</Text>
                <Text style={styles.text}>{formatCurrency(shipping)}</Text>
              </View>
            )}

            {isRC ? (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{vatLabel || LABELS.vat_reverse}</Text>
                <Text style={styles.text}>{formatCurrency(0)}</Text>
              </View>
            ) : isExempt ? (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{vatLabel || "Exento de IVA (Exportación)"}</Text>
                <Text style={styles.text}>{formatCurrency(0)}</Text>
              </View>
            ) : hasMultiVat ? (
              <>
                <View style={{ marginTop: 4, marginBottom: 2 }}>
                  <Text style={[styles.label, { fontSize: 7 }]}>{LABELS.vat_breakdown_title}</Text>
                </View>
                {vatBreakdown!.map((vb, idx) => (
                  <View key={idx} style={styles.totalRow}>
                    <Text style={[styles.text, { fontSize: 8 }]}>
                      IVA {vb.vatRate}% ({LABELS.vat_base}: {formatCurrency(vb.base)})
                    </Text>
                    <Text style={[styles.text, { fontSize: 8 }]}>{formatCurrency(vb.amount)}</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.text}>{LABELS.vat_label(vatRate)} (total)</Text>
                  <Text style={styles.text}>{formatCurrency(tax)}</Text>
                </View>
              </>
            ) : isSimplificada ? (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{LABELS.vat_included}</Text>
                <Text style={styles.text}>{formatCurrency(tax)}</Text>
              </View>
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{vatLabel || LABELS.vat_label(vatRate)}</Text>
                <Text style={styles.text}>{formatCurrency(tax)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {LABELS.grand_total}
              </Text>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {formatCurrency(total)}
              </Text>
            </View>

            {Number(invoice.paidAmount) > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.text}>{LABELS.paid}</Text>
                  <Text style={styles.text}>
                    {formatCurrency(Number(invoice.paidAmount))}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.text, styles.bold]}>{LABELS.balance}</Text>
                  <Text style={[styles.text, styles.bold]}>
                    {formatCurrency(total - Number(invoice.paidAmount))}
                  </Text>
                </View>
              </>
            )}

            {(isRC || isExempt) && (
              <View style={{ marginTop: 8, padding: 6, backgroundColor: "#fef9c3" }}>
                <Text style={{ fontSize: 7, color: "#854d0e", lineHeight: 1.5 }}>
                  {vatLegalNote || (isRC ? LABELS.reverse_charge_note : "Exento de IVA por exportación fuera de la UE según art. 21 Ley 37/1992 del IVA.")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{LABELS.thank_you}</Text>
          <Text style={{ marginTop: 2 }}>
            {sellerName} · {LABELS.nif} {sellerTaxId} · {sellerAddress}
          </Text>
          <Text style={{ marginTop: 1 }}>
            {sellerEmail} · Tel: {sellerPhone}
          </Text>
          {invoice.integrityHash && (
            <Text style={{ marginTop: 4, fontSize: 6, color: "#AAAAAA" }}>
              {LABELS.integrity} {invoice.integrityHash}
            </Text>
          )}
          {qrCodeDataUrl && (
            <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
              <Image src={qrCodeDataUrl} style={{ width: 60, height: 60 }} />
              <Text style={{ marginLeft: 6, fontSize: 6, color: "#AAAAAA", maxWidth: 200 }}>
                {LABELS.verifactu} Escanee para verificar / Scan to verify
              </Text>
            </View>
          )}
          {!qrCodeDataUrl && verifactuQrData && (
            <Text style={{ marginTop: 2, fontSize: 6, color: "#AAAAAA" }}>
              {LABELS.verifactu} {verifactuQrData}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
