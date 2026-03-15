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

// Centralised label dictionary — bilingual ES/EN
const LABELS = {
  title: "PACKING LIST / LISTA DE EMBALAJE",
  from: "SHIPPER / REMITENTE:",
  shipment_ref: "SHIPMENT REFERENCE / REFERENCIA DE ENVIO:",
  declaration_no: "Declaration No. / N\u00BA Declaraci\u00F3n:",
  tracking: "Tracking No. / N\u00BA Seguimiento:",
  date: "Date / Fecha:",
  shipping_method: "Shipping Method / M\u00E9todo de Env\u00EDo:",
  origin: "Country of Origin / Pa\u00EDs de Origen:",
  destination: "Destination / Destino:",
  vat_id: "Tax ID / NIF/CIF:",
  col_no: "#",
  col_item: "Item / Art\u00EDculo",
  col_sku: "SKU",
  col_qty: "Qty / Ud.",
  col_weight: "Weight (kg) / Peso (kg)",
  col_origin: "Origin / Origen",
  total_items: "Total Items / Total Art\u00EDculos:",
  total_qty: "Total Quantity / Cantidad Total:",
  total_weight: "Total Weight / Peso Total:",
  certification:
    "We hereby certify that the contents of this shipment are as described above and that all information is true and correct. / " +
    "Certificamos que el contenido de este env\u00EDo es el descrito anteriormente y que toda la informaci\u00F3n es verdadera y correcta.",
  prepared_by: "Prepared by / Preparado por:",
  date_signed: "Date / Fecha:",
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
  colNo: { flex: 0.4, textAlign: "center", fontSize: 9 },
  colItem: { flex: 3, fontSize: 9 },
  colSku: { flex: 1.2, fontSize: 9 },
  colQty: { flex: 0.8, textAlign: "center", fontSize: 9 },
  colWeight: { flex: 1, textAlign: "right", fontSize: 9 },
  colOrigin: { flex: 1, textAlign: "center", fontSize: 9 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  summaryBlock: {
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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

export interface PackingListPDFProps {
  declaration: {
    declarationNumber: string;
    trackingNumber?: string | null;
    shippingMethod?: string | null;
    countryOfOrigin?: string | null;
    destinationCountry?: string | null;
    createdAt: Date | string;
    items: Array<{
      productName: string;
      sku?: string | null;
      quantity: number;
      weight?: number | { toNumber(): number } | string | null;
      countryOfOrigin?: string | null;
    }>;
  };
  companyInfo?: {
    name?: string;
    address?: string;
    taxId?: string;
  };
}

export default function PackingListPDF({
  declaration,
  companyInfo,
}: PackingListPDFProps) {
  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const totalQuantity = declaration.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalWeight = declaration.items.reduce(
    (sum, item) => sum + toNum(item.weight),
    0
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>{LABELS.title}</Text>

        {/* Header — Shipper (left) + Shipment ref (right) */}
        <View style={styles.header}>
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>{LABELS.from}</Text>
            <Text style={styles.companyName}>
              {companyInfo?.name || "Company Name"}
            </Text>
            {companyInfo?.address && (
              <Text style={styles.text}>{companyInfo.address}</Text>
            )}
            {companyInfo?.taxId && (
              <Text style={[styles.text, styles.bold]}>
                {LABELS.vat_id} {companyInfo.taxId}
              </Text>
            )}
          </View>

          <View style={styles.box}>
            <Text style={styles.sectionTitle}>{LABELS.shipment_ref}</Text>
            <Text style={styles.text}>
              {LABELS.declaration_no} {declaration.declarationNumber}
            </Text>
            <Text style={styles.text}>
              {LABELS.date} {formatDate(declaration.createdAt)}
            </Text>
            {declaration.trackingNumber && (
              <Text style={styles.text}>
                {LABELS.tracking} {declaration.trackingNumber}
              </Text>
            )}
            {declaration.shippingMethod && (
              <Text style={styles.text}>
                {LABELS.shipping_method} {declaration.shippingMethod}
              </Text>
            )}
          </View>
        </View>

        {/* Origin / Destination */}
        {(declaration.countryOfOrigin || declaration.destinationCountry) && (
          <View style={styles.section}>
            {declaration.countryOfOrigin && (
              <View style={styles.box}>
                <Text style={styles.text}>
                  {LABELS.origin} {declaration.countryOfOrigin}
                </Text>
              </View>
            )}
            {declaration.destinationCountry && (
              <View style={styles.box}>
                <Text style={styles.text}>
                  {LABELS.destination} {declaration.destinationCountry}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colNo, styles.bold]}>{LABELS.col_no}</Text>
            <Text style={[styles.colItem, styles.bold]}>{LABELS.col_item}</Text>
            <Text style={[styles.colSku, styles.bold]}>{LABELS.col_sku}</Text>
            <Text style={[styles.colQty, styles.bold]}>{LABELS.col_qty}</Text>
            <Text style={[styles.colWeight, styles.bold]}>
              {LABELS.col_weight}
            </Text>
            <Text style={[styles.colOrigin, styles.bold]}>
              {LABELS.col_origin}
            </Text>
          </View>

          {declaration.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colNo}>{idx + 1}</Text>
              <Text style={styles.colItem}>{item.productName}</Text>
              <Text style={styles.colSku}>{item.sku || "-"}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
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

        {/* Totals Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.text}>{LABELS.total_items}</Text>
              <Text style={styles.text}>{declaration.items.length}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.text}>{LABELS.total_qty}</Text>
              <Text style={styles.text}>{totalQuantity}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {LABELS.total_weight}
              </Text>
              <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                {totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : "-"}
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
              <Text style={styles.label}>{LABELS.prepared_by}</Text>
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
