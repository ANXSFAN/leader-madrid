import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const str = val == null ? "" : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

async function toXlsx(rows: Record<string, unknown>[], sheetName: string): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  const headers = Object.keys(rows[0]);
  // Header row with styling
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  // Data rows
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h]));
  }

  // Auto column width
  for (let i = 0; i < headers.length; i++) {
    const col = sheet.getColumn(i + 1);
    let maxLen = headers[i].length;
    for (const row of rows) {
      const val = String(row[headers[i]] ?? "");
      if (val.length > maxLen) maxLen = val.length;
    }
    col.width = Math.min(maxLen + 4, 40);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function toPdf(rows: Record<string, unknown>[], title: string): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 22);

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((h) => String(row[h] ?? "")));

    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

async function getReportData(type: string, fromDate?: Date, toDate?: Date) {
  const dateFilter = fromDate || toDate
    ? { gte: fromDate, lte: toDate }
    : undefined;

  if (type === "sales") {
    const orders = await db.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        createdAt: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        tax: true,
        total: true,
        user: { select: { name: true, email: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      rows: orders.map((o) => ({
        date: o.createdAt.toISOString().slice(0, 10),
        orderNumber: o.orderNumber,
        customer: o.user?.companyName || o.user?.name || o.user?.email || "",
        status: o.status,
        subtotal: Number(o.subtotal).toFixed(2),
        tax: Number(o.tax).toFixed(2),
        total: Number(o.total).toFixed(2),
      })),
      sheetName: "Sales Report",
      filename: `sales-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  if (type === "inventory") {
    const variants = await db.productVariant.findMany({
      select: {
        sku: true,
        physicalStock: true,
        allocatedStock: true,
        minStock: true,
        costPrice: true,
        product: { select: { content: true } },
      },
      orderBy: { physicalStock: "asc" },
    });

    return {
      rows: variants.map((v) => {
        const content = v.product.content as Record<string, { name?: string }> | null;
        const productName = content?.es?.name || content?.en?.name || v.sku;
        const cost = Number(v.costPrice ?? 0);
        return {
          sku: v.sku,
          productName,
          physicalStock: v.physicalStock,
          allocatedStock: v.allocatedStock,
          minStock: v.minStock,
          costPrice: cost.toFixed(2),
          inventoryValue: (v.physicalStock * cost).toFixed(2),
        };
      }),
      sheetName: "Inventory Report",
      filename: `inventory-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  if (type === "orders") {
    const orders = await db.order.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      select: {
        createdAt: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        user: { select: { name: true, email: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      rows: orders.map((o) => ({
        date: o.createdAt.toISOString().slice(0, 10),
        orderNumber: o.orderNumber,
        customer: o.user?.companyName || o.user?.name || o.user?.email || "",
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: Number(o.total).toFixed(2),
      })),
      sheetName: "Orders Report",
      filename: `orders-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  if (type === "margins") {
    const items = await db.orderItem.findMany({
      where: {
        order: {
          status: { not: "CANCELLED" },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        costPrice: { not: null },
      },
      select: {
        name: true,
        sku: true,
        quantity: true,
        price: true,
        costPrice: true,
        total: true,
      },
    });

    return {
      rows: items.map((i) => {
        const revenue = Number(i.total);
        const cost = Number(i.costPrice!) * i.quantity;
        const profit = revenue - cost;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + "%" : "0%";
        return {
          product: i.name || "—",
          sku: i.sku || "—",
          quantity: i.quantity,
          revenue: revenue.toFixed(2),
          cost: cost.toFixed(2),
          profit: profit.toFixed(2),
          margin,
        };
      }),
      sheetName: "Margin Report",
      filename: `margin-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  if (type === "procurement") {
    const pos = await db.purchaseOrder.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      select: {
        poNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      rows: pos.map((po) => ({
        date: po.createdAt.toISOString().slice(0, 10),
        poNumber: po.poNumber,
        supplier: po.supplier.name || "",
        status: po.status,
        amount: Number(po.totalAmount).toFixed(2),
        currency: po.currency,
      })),
      sheetName: "Procurement Report",
      filename: `procurement-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  if (type === "ar") {
    const invoices = await db.invoice.findMany({
      where: {
        status: { notIn: ["CANCELLED", "DRAFT"] },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        issueDate: true,
        dueDate: true,
        customer: { select: { name: true, companyName: true } },
      },
      orderBy: { issueDate: "desc" },
    });

    return {
      rows: invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.companyName || inv.customer.name || "",
        status: inv.status,
        totalAmount: Number(inv.totalAmount).toFixed(2),
        paidAmount: Number(inv.paidAmount).toFixed(2),
        outstanding: (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2),
        issueDate: inv.issueDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
      })),
      sheetName: "Accounts Receivable",
      filename: `ar-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SALES_REP"].includes(session.user?.role as string)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const fmt = (searchParams.get("format") || "csv") as "csv" | "xlsx" | "pdf";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  if (!type) {
    return new NextResponse("Missing report type", { status: 400 });
  }

  const data = await getReportData(type, fromDate, toDate);
  if (!data) {
    return new NextResponse("Invalid report type", { status: 400 });
  }

  if (fmt === "xlsx") {
    const buffer = await toXlsx(data.rows, data.sheetName);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${data.filename}.xlsx"`,
      },
    });
  }

  if (fmt === "pdf") {
    const buffer = await toPdf(data.rows, data.sheetName);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.filename}.pdf"`,
      },
    });
  }

  // Default: CSV
  const csv = toCsv(data.rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.filename}.csv"`,
    },
  });
}
