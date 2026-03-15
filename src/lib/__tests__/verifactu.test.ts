import {
  buildVerifactuQrData,
  mapInvoiceTypeToVerifactu,
  buildRegistrationRecord,
} from "../verifactu";

describe("verifactu", () => {
  describe("buildVerifactuQrData", () => {
    it("should build valid QR URL with all params", () => {
      const url = buildVerifactuQrData({
        issuerNIF: "B12345678",
        invoiceNumber: "INV-2026-0001",
        invoiceDate: "2026-03-08",
        totalAmount: "1210.00",
      });

      expect(url).toContain("agenciatributaria.gob.es");
      expect(url).toContain("nif=B12345678");
      expect(url).toContain("numserie=INV-2026-0001");
      expect(url).toContain("fecha=2026-03-08");
      expect(url).toContain("importe=1210.00");
    });

    it("should URL-encode special characters in invoice number", () => {
      const url = buildVerifactuQrData({
        issuerNIF: "B12345678",
        invoiceNumber: "INV/2026/0001",
        invoiceDate: "2026-01-01",
        totalAmount: "100.00",
      });

      // URLSearchParams encodes / as %2F
      expect(url).toContain("numserie=INV%2F2026%2F0001");
    });
  });

  describe("mapInvoiceTypeToVerifactu", () => {
    it("should map STANDARD to F1", () => {
      expect(mapInvoiceTypeToVerifactu("STANDARD")).toBe("F1");
    });

    it("should map SIMPLIFICADA to F2", () => {
      expect(mapInvoiceTypeToVerifactu("SIMPLIFICADA")).toBe("F2");
    });

    it("should map SIMPLIFICADA rectificativa to R5", () => {
      expect(mapInvoiceTypeToVerifactu("SIMPLIFICADA", true)).toBe("R5");
    });

    it("should map RECTIFICATIVA to R1", () => {
      expect(mapInvoiceTypeToVerifactu("RECTIFICATIVA")).toBe("R1");
    });

    it("should default unknown types to F1", () => {
      expect(mapInvoiceTypeToVerifactu("UNKNOWN_TYPE")).toBe("F1");
    });
  });

  describe("buildRegistrationRecord", () => {
    const baseInvoice = {
      invoiceNumber: "INV-2026-0001",
      issueDate: "2026-03-08",
      invoiceType: "STANDARD",
      totalAmount: 1210,
      sellerSnapshot: {
        taxId: "B12345678",
        name: "LED Company SL",
      },
      buyerSnapshot: {
        taxId: "A87654321",
        company: "Client Corp SA",
        name: "Client Name",
      },
      vatRate: 21,
      tax: 210,
      subtotal: 1000,
      isReverseCharge: false,
      isExempt: false,
      integrityHash: "abc123hash",
      previousHash: "prevhash456",
    };

    it("should build a complete registration record", () => {
      const record = buildRegistrationRecord(baseInvoice);

      expect(record.invoiceNumber).toBe("INV-2026-0001");
      expect(record.invoiceDate).toBe("2026-03-08");
      expect(record.invoiceType).toBe("F1");
      expect(record.issuerNIF).toBe("B12345678");
      expect(record.issuerName).toBe("LED Company SL");
      expect(record.recipientNIF).toBe("A87654321");
      expect(record.recipientName).toBe("Client Corp SA");
      expect(record.totalAmount).toBe("1210.00");
      expect(record.integrityHash).toBe("abc123hash");
      expect(record.previousHash).toBe("prevhash456");
      expect(record.softwareName).toBe("MyLED ERP");
    });

    it("should build single-rate tax breakdown", () => {
      const record = buildRegistrationRecord(baseInvoice);

      expect(record.taxBreakdown).toHaveLength(1);
      expect(record.taxBreakdown[0].taxType).toBe("IVA");
      expect(record.taxBreakdown[0].vatRate).toBe("21.00");
      expect(record.taxBreakdown[0].taxableBase).toBe("1000.00");
      expect(record.taxBreakdown[0].taxAmount).toBe("210.00");
      expect(record.taxBreakdown[0].isReverseCharge).toBe(false);
    });

    it("should use multi-rate breakdown when provided", () => {
      const invoice = {
        ...baseInvoice,
        vatBreakdown: [
          { vatRate: 21, base: "800.00", amount: "168.00" },
          { vatRate: 10, base: "200.00", amount: "20.00" },
        ],
      };

      const record = buildRegistrationRecord(invoice);

      expect(record.taxBreakdown).toHaveLength(2);
      expect(record.taxBreakdown[0].vatRate).toBe("21.00");
      expect(record.taxBreakdown[1].vatRate).toBe("10.00");
    });

    it("should include rectificativa references", () => {
      const invoice = {
        ...baseInvoice,
        invoiceType: "RECTIFICATIVA",
        originalInvoice: {
          invoiceNumber: "INV-2026-0000",
          issueDate: "2026-02-01",
        },
        rectificationReason: "Error en importe",
      };

      const record = buildRegistrationRecord(invoice);

      expect(record.invoiceType).toBe("R1");
      expect(record.originalInvoiceNumber).toBe("INV-2026-0000");
      expect(record.originalInvoiceDate).toBe("2026-02-01");
      expect(record.rectificationReason).toBe("Error en importe");
    });

    it("should handle missing seller/buyer snapshot", () => {
      const invoice = {
        ...baseInvoice,
        sellerSnapshot: null,
        buyerSnapshot: null,
      };

      const record = buildRegistrationRecord(invoice);

      expect(record.issuerNIF).toBe("");
      expect(record.issuerName).toBe("");
      expect(record.recipientNIF).toBeUndefined();
    });

    it("should handle reverse charge invoices", () => {
      const invoice = { ...baseInvoice, isReverseCharge: true };
      const record = buildRegistrationRecord(invoice);

      expect(record.taxBreakdown[0].isReverseCharge).toBe(true);
    });
  });
});
