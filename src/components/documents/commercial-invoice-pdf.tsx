import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Helper to convert Prisma Decimal / string / number to plain number
function toNum(
  v: number | { toNumber(): number } | string | null | undefined
): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return v.toNumber();
}

// Centralised label dictionary — bilingual ES/EN for international trade
const LABELS = {
  title: "COMMERCIAL INVOICE / FACTURA COMERCIAL",
  from: "EXPORTER / EXPORTADOR:",
  consignee: "CONSIGNEE / DESTINATARIO:",
  shipment_details: "SHIPMENT DETAILS / DATOS DEL ENVIO:",
  declaration_no: "Declaration No. / N\u00BA Declaraci\u00F3n:",
  date: "Date / Fecha:",
  country_of_origin: "Country of Origin / Pa\u00EDs de Origen:",
  destination: "Destination / Destino:",
  entry_port: "Port of Entry / Puerto de Entrada:",
  shipping_method: "Shipping Method / M\u00E9todo de Env\u00EDo:",
  broker: "Customs Broker / Agente de Aduanas:",
  currency: "Currency / Moneda:",
  col_item: "Item / Art\u00EDculo",
  col_hs_code: "HS Code / C\u00F3digo SA",
  col_qty: "Qty / Ud.",
  col_unit_price: "Unit Price / Precio Ud.",
  col_total: "Total Value / Valor Total",
  col_weight: "Weight (kg) / Peso (kg)",
  col_origin: "Origin / Origen",
  declared_value: "Declared Value / Valor Declarado:",
  duty_amount: "Duty Amount / Derechos Arancelarios:",
  vat_amount: "VAT / IVA:",
  other_charges: "Other Charges / Otros Cargos:",
  grand_total: "TOTAL COST / COSTE TOTAL:",
  certification:
    "I hereby certify that the information contained in this commercial invoice is true and correct to the best of my knowledge. / " +
    "Certifico que la informaci\u00F3n contenida en esta factura comercial es verdadera y correcta seg\u00FAn mi leal saber y entender.",
  signature: "Signature / Firma:",
  date_signed: "Date / Fecha:",
  vat_id: "Tax ID / NIF/CIF:",
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
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  box: {
    width: "48%",
  },
  fullBox: {
    width: "100%",
    marginBottom: 15,
  },
  label: {
    fontSize: 8,
    color: "#888888",
    marginBottom: 2,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 6,
    backgroundColor: "#F9FAFB",
    padding: 4,
  },
  text: {
    marginBottom: 2,
    lineHeight: 1.4,
  },
  bold: { fontWeight: "bold" },
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
    padding: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    padding: 6,
  },
  colItem: { flex: 2.5, fontSize: 9 },
  colHs: { flex: 1.2, textAlign: "center", fontSize: 9 },
  colQty: { flex: 0.7, textAlign: "center", fontSize: 9 },
  colPrice: { flex: 1, textAlign: "right", fontSize: 9 },
  colTotal: { flex: 1, textAlign: "right", fontSize: 9 },
  colWeight: { flex: 0.8, textAlign: "right", fontSize: 9 },
  colOrigin: { flex: 0.8, textAlign: "center", fontSize: 9 },
  totals: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 240,
    marginBottom: 4,
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
    fontSize: 8,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 10,
  },
  certificationBox: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    backgroundColor: "#FAFAFA",
  },
});

export interface CommercialInvoicePDFProps {
  declaration: {
    declarationNumber: string;
    type: string;
    countryOfOrigin?: string | null;
    destinationCountry?: string | null;
    entryPort?: string | null;
    shippingMethod?: string | null;
    declaredValue: number | { toNumber(): number } | string;
    dutyAmount?: number | { toNumber(): number } | string | null;
    vatAmount?: number | { toNumber(): number } | string | null;
    otherCharges?: number | { toNumber(): number } | string | null;
    totalCost?: number | { toNumber(): number } | string | null;
    currency: string;
    brokerName?: string | null;
    createdAt: Date | string;
    items: Array<{
      productName: string;
      sku?: string | null;
      hsCode?: string | null;
      quantity: number;
      unitPrice: number | { toNumber(): number } | string;
      totalValue: number | { toNumber(): number } | string;
      weight?: number | { toNumber(): number } | string | null;
      countryOfOrigin?: string | null;
    }>;
  };
  companyInfo?: {
    name?: string;
    address?: string;
    taxId?: string;
    phone?: string;
    email?: string;
  };
  consigneeInfo?: {
    name?: string;
    company?: string;
    address?: string;
    taxId?: string;
  };
}

export default function CommercialInvoicePDF({
  declaration,
  companyInfo,
  consigneeInfo,
}: CommercialInvoicePDFProps) {
  const currency = declaration.currency || "EUR";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const declaredValue = toNum(declaration.declaredValue);
  const dutyAmount = toNum(declaration.dutyAmount);
  const vatAmount = toNum(declaration.vatAmount);
  const otherCharges = toNum(declaration.otherCharges);
  const totalCost = toNum(declaration.totalCost) || declaredValue + dutyAmount + vatAmount + otherCharges;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>{LABELS.title}</Text>

        {/* Header — Exporter (left) + Declaration meta (right) */}
        <View style={styles.header}>
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>{LABELS.from}</Text>
            <Text style={styles.companyName}>
              {companyInfo?.name || "Company Name"}
            </Text>
            {companyInfo?.address && (
              <Text style={styles.text}>{companyInfo.address}</Text>
            )}
            {companyInfo?.phone && (
              <Text style={styles.text}>Tel: {companyInfo.phone}</Text>
            )}
            {companyInfo?.email && (
              <Text style={styles.text}>{companyInfo.email}</Text>
            )}
            {companyInfo?.taxId && (
              <Text style={[styles.text, styles.bold]}>
                {LABELS.vat_id} {companyInfo.taxId}
              </Text>
            )}
          </View>

          <View style={styles.box}>
            <Text style={styles.text}>
              {LABELS.declaration_no} {declaration.declarationNumber}
            </Text>
            <Text style={styles.text}>
              {LABELS.date} {formatDate(declaration.createdAt)}
            </Text>
            <Text style={styles.text}>
              {LABELS.currency} {currency}
            </Text>
          </View>
        </View>

        {/* Consignee */}
        {consigneeInfo && (
          <View style={styles.fullBox}>
            <Text style={styles.sectionTitle}>{LABELS.consignee}</Text>
            {consigneeInfo.company && (
              <Text style={[styles.text, styles.bold]}>
                {consigneeInfo.company}
              </Text>
            )}
            {consigneeInfo.name && (
              <Text style={styles.text}>{consigneeInfo.name}</Text>
            )}
            {consigneeInfo.address && (
              <Text style={styles.text}>{consigneeInfo.address}</Text>
            )}
            {consigneeInfo.taxId && (
              <Text style={styles.text}>
                {LABELS.vat_id} {consigneeInfo.taxId}
              </Text>
            )}
          </View>
        )}

        {/* Shipment Details */}
        <View style={styles.fullBox}>
          <Text style={styles.sectionTitle}>{LABELS.shipment_details}</Text>
          <View style={styles.section}>
            <View style={styles.box}>
              {declaration.countryOfOrigin && (
                <Text style={styles.text}>
                  {LABELS.country_of_origin} {declaration.countryOfOrigin}
                </Text>
              )}
              {declaration.destinationCountry && (
                <Text style={styles.text}>
                  {LABELS.destination} {declaration.destinationCountry}
                </Text>
              )}
              {declaration.entryPort && (
                <Text style={styles.text}>
                  {LABELS.entry_port} {declaration.entryPort}
                </Text>
              )}
            </View>
            <View style={styles.box}>
              {declaration.shippingMethod && (
                <Text style={styles.text}>
                  {LABELS.shipping_method} {declaration.shippingMethod}
                </Text>
              )}
              {declaration.brokerName && (
                <Text style={styles.text}>
                  {LABELS.broker} {declaration.brokerName}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colItem, styles.bold]}>{LABELS.col_item}</Text>
            <Text style={[styles.colHs, styles.bold]}>{LABELS.col_hs_code}</Text>
            <Text style={[styles.colQty, styles.bold]}>{LABELS.col_qty}</Text>
            <Text style={[styles.colPrice, styles.bold]}>
              {LABELS.col_unit_price}
            </Text>
            <Text style={[styles.colTotal, styles.bold]}>{LABELS.col_total}</Text>
            <Text style={[styles.colWeight, styles.bold]}>
              {LABELS.col_weight}
            </Text>
            <Text style={[styles.colOrigin, styles.bold]}>
              {LABELS.col_origin}
            </Text>
          </View>

          {declaration.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <View style={styles.colItem}>
                <Text>{item.productName}</Text>
                {item.sku && (
                  <Text style={{ fontSize: 7, color: "#888888" }}>
                    SKU: {item.sku}
                  </Text>
                )}
              </View>
              <Text style={styles.colHs}>{item.hsCode || "-"}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(toNum(item.unitPrice))}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(toNum(item.totalValue))}
              </Text>
              <Text style={styles.colWeight}>
                {toNum(item.weight) > 0
                  ? `${toNum(item.weight).toFixed(2)}`
                  : "-"}
              </Text>
              <Text style={styles.colOrigin}>
                {item.countryOfOrigin || "-"}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View>
            <View style={styles.totalRow}>
              <Text style={styles.text}>{LABELS.declared_value}</Text>
              <Text style={styles.text}>{formatCurrency(declaredValue)}</Text>
            </View>

            {dutyAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{LABELS.duty_amount}</Text>
                <Text style={styles.text}>{formatCurrency(dutyAmount)}</Text>
              </View>
            )}

            {vatAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{LABELS.vat_amount}</Text>
                <Text style={styles.text}>{formatCurrency(vatAmount)}</Text>
              </View>
            )}

            {otherCharges > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.text}>{LABELS.other_charges}</Text>
                <Text style={styles.text}>{formatCurrency(otherCharges)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {LABELS.grand_total}
              </Text>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {formatCurrency(totalCost)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer — Certification */}
        <View style={styles.footer}>
          <View style={styles.certificationBox}>
            <Text style={{ lineHeight: 1.5 }}>{LABELS.certification}</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <View>
              <Text style={styles.label}>{LABELS.signature}</Text>
              <Text style={{ marginTop: 20 }}>
                ____________________________
              </Text>
            </View>
            <View>
              <Text style={styles.label}>{LABELS.date_signed}</Text>
              <Text style={{ marginTop: 4 }}>
                {formatDate(declaration.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
