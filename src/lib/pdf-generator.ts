import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface OrderPDFData {
  type: "PURCHASE_ORDER" | "SALES_ORDER" | "INVOICE";
  orderNumber: string;
  date: Date;
  dueDate?: Date;
  status: string;
  currency?: string;
  locale?: string;
  entity: {
    title: string;
    name: string;
    email?: string;
    company?: string | null;
    address?: string | null;
    taxId?: string | null;
  };
  items: {
    sku: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  totals: {
    subtotal: number;
    tax?: number;
    total: number;
    paid?: number;
    balance?: number;
  };
  paymentInfo?: {
    bankName?: string;
    accountNumber?: string;
    swift?: string;
  };
}

export function generateOrderPDF(data: OrderPDFData) {
  const currency = data.currency || "EUR";
  const locale = data.locale || "en";
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);

  const doc = new jsPDF();

  // --- Header ---
  doc.setFontSize(20);
  doc.text("ZELURA", 14, 22);

  doc.setFontSize(10);
  doc.text("Generated on: " + format(new Date(), "PPP"), 14, 28);
  doc.text("Calle Industria 123, 28000 Madrid, Spain", 14, 33);
  doc.text("VAT: ES-B12345678", 14, 38);

  // --- Document Title & Info ---
  doc.setFontSize(16);
  let title = "";
  if (data.type === "PURCHASE_ORDER") title = "PURCHASE ORDER";
  else if (data.type === "SALES_ORDER") title = "SALES ORDER";
  else if (data.type === "INVOICE") title = "INVOICE";

  const rightX = 140;
  doc.text(title, rightX, 22);

  doc.setFontSize(10);
  doc.text(`#: ${data.orderNumber}`, rightX, 28);
  doc.text(`Date: ${format(data.date, "PPP")}`, rightX, 33);

  if (data.dueDate) {
    doc.text(`Due Date: ${format(data.dueDate, "PPP")}`, rightX, 38);
    doc.text(`Status: ${data.status}`, rightX, 43);
  } else {
    doc.text(`Status: ${data.status}`, rightX, 38);
  }

  // --- Bill To / Ship To ---
  const startY = 55;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.entity.title, 14, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let yPos = startY + 5;

  if (data.entity.company) {
    doc.text(data.entity.company, 14, yPos);
    yPos += 5;
  }

  doc.text(data.entity.name, 14, yPos);
  yPos += 5;

  if (data.entity.email) {
    doc.text(data.entity.email, 14, yPos);
    yPos += 5;
  }

  if (data.entity.address) {
    // Handle multiline address
    const splitAddress = doc.splitTextToSize(data.entity.address, 80);
    doc.text(splitAddress, 14, yPos);
    yPos += (Array.isArray(splitAddress) ? splitAddress.length : 1) * 5;
  }

  if (data.entity.taxId) {
    doc.text(`Tax ID: ${data.entity.taxId}`, 14, yPos);
    yPos += 5;
  }

  // --- Items Table ---
  const tableStartY = Math.max(yPos + 10, 90);

  autoTable(doc, {
    startY: tableStartY,
    head: [["SKU", "Description", "Qty", "Price", "Total"]],
    body: data.items.map((item) => [
      item.sku,
      item.name,
      item.quantity,
      fmt(Number(item.price)),
      fmt(Number(item.total)),
    ]),
    foot: [
      ["", "", "", "Subtotal:", fmt(Number(data.totals.subtotal))],
      ["", "", "", "VAT:", fmt(Number(data.totals.tax) || 0)],
      ["", "", "", "Total:", fmt(Number(data.totals.total))],
    ],
    theme: "grid",
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
  });

  // Save PDF
  doc.save(`${title.toLowerCase().replace(" ", "_")}_${data.orderNumber}.pdf`);
}
