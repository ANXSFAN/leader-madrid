import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SiteSettingsData } from "@/lib/actions/config";
import { getCountryName } from "@/lib/vat";

// Centralised label dictionary – ready for future i18n integration
const LABELS = {
  invoice_title: "FACTURA",
  date_label: "Fecha:",
  po_ref: "Ref. PO:",
  status_paid: "PAGADO",
  status_pending: "PENDIENTE DE PAGO",
  seller_label: "Vendedor / Emisor",
  buyer_label: "Cliente / Destinatario",
  nif: "NIF/CIF:",
  nif_vat: "NIF/CIF/VAT:",
  col_description: "DESCRIPCIÓN / REFERENCIA",
  col_qty: "CANT.",
  col_unit_price: "PRECIO UNIT.",
  col_total: "TOTAL",
  sku_ref: "REF:",
  subtotal: "Base Imponible:",
  shipping: "Gastos de Envío:",
  vat_reverse: "IVA (Inversión sujeto pasivo):",
  vat_exempt: "IVA (Exento exportación):",
  vat_label: (rate: number) => `IVA ${rate}%:`,
  grand_total: "TOTAL FACTURA:",
  legal_reverse_charge:
    "Exento de IVA. Inversión del sujeto pasivo según art. 84 Ley 37/1992 del IVA y art. 194 Directiva 2006/112/CE.",
  legal_export:
    "Operación exenta de IVA por exportación fuera de la UE según art. 21 Ley 37/1992 del IVA.",
  e_invoice: "Factura generada electrónicamente",
  buyer_default: "Cliente",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#333333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a5f",
  },
  sellerBlock: {
    flex: 1,
  },
  invoiceBlock: {
    textAlign: "right",
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 4,
  },
  invoiceTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    marginBottom: 6,
  },
  invoiceNumber: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  textSmall: {
    fontSize: 9,
    marginBottom: 2,
    color: "#555",
  },
  textBold: {
    fontFamily: "Helvetica-Bold",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 20,
  },
  partyBox: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 4,
  },
  partyLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 3,
  },
  partyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  table: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a5f",
    padding: "6 8",
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "center" },
  colUnitPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  totalsBox: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  totalsRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#1e3a5f",
    marginTop: 2,
    borderRadius: 2,
  },
  totalsGrandText: {
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  legalNote: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef9c3",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    borderRadius: 2,
    marginBottom: 16,
  },
  legalNoteText: {
    fontSize: 8,
    color: "#854d0e",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
  paymentStatus: {
    padding: "4 10",
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
});

export interface WebOrderForPDF {
  id: string;
  orderNumber: string;
  createdAt: string | Date;
  subtotal: string | number;
  tax: string | number;
  shipping: string | number;
  total: string | number;
  vatRate: string | number;
  isReverseCharge: boolean;
  buyerVatNumber?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  poNumber?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    companyName?: string | null;
    taxId?: string | null;
  } | null;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    company?: string | null;
    street: string;
    city: string;
    state?: string | null;
    zipCode: string;
    country: string;
    phone?: string | null;
  } | null;
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    price: string | number;
    total: string | number;
  }[];
}

interface WebOrderInvoicePDFProps {
  order: WebOrderForPDF;
  settings: SiteSettingsData;
  /** BCP-47 locale for number/date formatting. Defaults to "en". */
  locale?: string;
}

export default function WebOrderInvoicePDF({
  order,
  settings,
  locale = "en",
}: WebOrderInvoicePDFProps) {
  const currency = settings.currency || "EUR";

  const fmt = (amount: string | number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      Number(amount)
    );

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const subtotal = Number(order.subtotal);
  const vatAmount = Number(order.tax);
  const shipping = Number(order.shipping);
  const total = Number(order.total);
  const vatRate = Number(order.vatRate);
  const addr = order.shippingAddress;
  const buyerName =
    order.user?.companyName ||
    order.user?.name ||
    (addr ? `${addr.firstName} ${addr.lastName}` : LABELS.buyer_default);

  const buyerVatId = order.buyerVatNumber || order.user?.taxId;

  const legalNote = order.isReverseCharge
    ? LABELS.legal_reverse_charge
    : vatRate === 0
    ? LABELS.legal_export
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.sellerBlock}>
            <Text style={styles.companyName}>{settings.siteName}</Text>
            <Text style={styles.textSmall}>{settings.address}</Text>
            {settings.sellerTaxId && (
              <Text style={styles.textSmall}>{LABELS.nif} {settings.sellerTaxId}</Text>
            )}
            <Text style={styles.textSmall}>{settings.phoneNumber}</Text>
            <Text style={styles.textSmall}>{settings.contactEmail}</Text>
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>{LABELS.invoice_title}</Text>
            <Text style={styles.invoiceNumber}>{order.orderNumber}</Text>
            <Text style={styles.textSmall}>{LABELS.date_label} {fmtDate(order.createdAt)}</Text>
            {order.poNumber && (
              <Text style={styles.textSmall}>{LABELS.po_ref} {order.poNumber}</Text>
            )}
            <Text
              style={[
                styles.textSmall,
                {
                  marginTop: 4,
                  color: order.paymentStatus === "PAID" ? "#16a34a" : "#d97706",
                  fontFamily: "Helvetica-Bold",
                },
              ]}
            >
              {order.paymentStatus === "PAID" ? LABELS.status_paid : LABELS.status_pending}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>{LABELS.seller_label}</Text>
            <Text style={styles.partyName}>{settings.siteName}</Text>
            {settings.sellerTaxId && (
              <Text style={styles.textSmall}>{LABELS.nif} {settings.sellerTaxId}</Text>
            )}
            <Text style={styles.textSmall}>{settings.address}</Text>
            <Text style={styles.textSmall}>{settings.contactEmail}</Text>
          </View>

          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>{LABELS.buyer_label}</Text>
            <Text style={styles.partyName}>{buyerName}</Text>
            {buyerVatId && (
              <Text style={styles.textSmall}>{LABELS.nif_vat} {buyerVatId}</Text>
            )}
            {order.user?.email && (
              <Text style={styles.textSmall}>{order.user.email}</Text>
            )}
            {addr && (
              <>
                <Text style={styles.textSmall}>{addr.street}</Text>
                <Text style={styles.textSmall}>
                  {addr.zipCode} {addr.city}
                  {addr.state ? `, ${addr.state}` : ""}
                </Text>
                <Text style={styles.textSmall}>
                  {getCountryName(addr.country)}
                </Text>
                {addr.phone && (
                  <Text style={styles.textSmall}>{addr.phone}</Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>
              {LABELS.col_description}
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>{LABELS.col_qty}</Text>
            <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>
              {LABELS.col_unit_price}
            </Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>{LABELS.col_total}</Text>
          </View>

          {order.items.map((item, idx) => (
            <View
              key={item.id}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <View style={styles.colDescription}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 8, color: "#888" }}>
                  {LABELS.sku_ref} {item.sku}
                </Text>
              </View>
              <Text style={[styles.textSmall, styles.colQty]}>
                {item.quantity}
              </Text>
              <Text style={[styles.textSmall, styles.colUnitPrice]}>
                {fmt(item.price)}
              </Text>
              <Text style={[styles.textSmall, styles.colTotal]}>
                {fmt(item.total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.textSmall}>{LABELS.subtotal}</Text>
              <Text style={[styles.textSmall, styles.textBold]}>{fmt(subtotal)}</Text>
            </View>

            {shipping > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.textSmall}>{LABELS.shipping}</Text>
                <Text style={styles.textSmall}>{fmt(shipping)}</Text>
              </View>
            )}

            <View style={styles.totalsRow}>
              <Text style={styles.textSmall}>
                {order.isReverseCharge
                  ? LABELS.vat_reverse
                  : vatRate === 0
                  ? LABELS.vat_exempt
                  : LABELS.vat_label(vatRate)}
              </Text>
              <Text style={styles.textSmall}>
                {vatAmount === 0 ? fmt(0) : fmt(vatAmount)}
              </Text>
            </View>

            <View style={styles.totalsRowGrand}>
              <Text style={styles.totalsGrandText}>{LABELS.grand_total}</Text>
              <Text style={styles.totalsGrandText}>{fmt(total)}</Text>
            </View>
          </View>
        </View>

        {legalNote && (
          <View style={styles.legalNote}>
            <Text style={styles.legalNoteText}>{legalNote}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {settings.siteName} · {LABELS.nif} {settings.sellerTaxId ?? "—"} ·{" "}
            {settings.address}
          </Text>
          <Text style={styles.footerText}>
            {LABELS.e_invoice} · {settings.contactEmail}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
