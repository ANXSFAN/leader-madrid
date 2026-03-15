import {
  determineVAT,
  validateEUVATFormat,
  getCountryName,
  EU_VAT_RATES,
  EU_COUNTRY_CODES,
  COUNTRY_LIST,
} from "../vat";

describe("determineVAT", () => {
  describe("domestic sales (Spain → Spain)", () => {
    it("should apply 21% IVA for domestic sale", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "ES",
      });

      expect(result.vatRate).toBe(21);
      expect(result.vatAmount).toBe(210);
      expect(result.isReverseCharge).toBe(false);
      expect(result.isExempt).toBe(false);
    });

    it("should handle case-insensitive country code", () => {
      const result = determineVAT({
        subtotal: 100,
        buyerCountry: "es",
      });
      expect(result.vatRate).toBe(21);
    });

    it("should trim whitespace from country code", () => {
      const result = determineVAT({
        subtotal: 100,
        buyerCountry: " ES ",
      });
      expect(result.vatRate).toBe(21);
    });
  });

  describe("intra-EU B2B (with VAT number)", () => {
    it("should apply reverse charge for EU B2B with VAT number", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "DE",
        buyerVATNumber: "DE123456789",
      });

      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.isReverseCharge).toBe(true);
      expect(result.isExempt).toBe(false);
      expect(result.legalNote).toContain("Art. 194");
    });

    it("should apply reverse charge for France B2B", () => {
      const result = determineVAT({
        subtotal: 500,
        buyerCountry: "FR",
        buyerVATNumber: "FR12345678901",
      });

      expect(result.vatRate).toBe(0);
      expect(result.isReverseCharge).toBe(true);
    });
  });

  describe("intra-EU B2C (without VAT number)", () => {
    it("should apply destination country VAT for EU B2C", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "DE",
      });

      // Germany's standard rate is 19%
      expect(result.vatRate).toBe(19);
      expect(result.vatAmount).toBe(190);
      expect(result.isReverseCharge).toBe(false);
      expect(result.isExempt).toBe(false);
    });

    it("should apply France 20% for French B2C", () => {
      const result = determineVAT({
        subtotal: 100,
        buyerCountry: "FR",
      });
      expect(result.vatRate).toBe(20);
      expect(result.vatAmount).toBe(20);
    });

    it("should apply Hungary 27% (highest EU rate)", () => {
      const result = determineVAT({
        subtotal: 100,
        buyerCountry: "HU",
      });
      expect(result.vatRate).toBe(27);
      expect(result.vatAmount).toBe(27);
    });
  });

  describe("non-EU exports", () => {
    it("should be VAT exempt for non-EU countries", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "US",
      });

      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.isReverseCharge).toBe(false);
      expect(result.isExempt).toBe(true);
      expect(result.legalNote).toContain("Art. 21 LIVA");
    });

    it("should be VAT exempt for UK (post-Brexit)", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "GB",
      });

      expect(result.vatRate).toBe(0);
      expect(result.isExempt).toBe(true);
    });

    it("should be exempt even if VAT number provided (non-EU)", () => {
      const result = determineVAT({
        subtotal: 1000,
        buyerCountry: "US",
        buyerVATNumber: "US-12345",
      });

      expect(result.vatRate).toBe(0);
      expect(result.isExempt).toBe(true);
    });
  });

  describe("rounding", () => {
    it("should round to 2 decimal places", () => {
      const result = determineVAT({
        subtotal: 33.33,
        buyerCountry: "ES",
      });
      // 33.33 * 0.21 = 6.9993 → 7.00
      expect(result.vatAmount).toBe(7);
    });
  });
});

describe("validateEUVATFormat", () => {
  it("should validate Spanish VAT numbers", () => {
    expect(validateEUVATFormat("ESB12345678").valid).toBe(true);
    expect(validateEUVATFormat("ES12345678A").valid).toBe(true);
  });

  it("should validate German VAT numbers", () => {
    expect(validateEUVATFormat("DE123456789").valid).toBe(true);
  });

  it("should reject too short VAT numbers", () => {
    const result = validateEUVATFormat("DE1");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("too short");
  });

  it("should reject non-EU country codes", () => {
    const result = validateEUVATFormat("US123456789");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("EU country code");
  });

  it("should reject empty input", () => {
    expect(validateEUVATFormat("").valid).toBe(false);
    expect(validateEUVATFormat("  ").valid).toBe(false);
  });

  it("should clean and normalize input", () => {
    // With spaces and dashes
    expect(validateEUVATFormat("ES B-1234.5678").valid).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(validateEUVATFormat("de123456789").valid).toBe(true);
  });

  it("should reject invalid format for known countries", () => {
    // German VAT must be exactly 9 digits
    expect(validateEUVATFormat("DE12345").valid).toBe(false);
  });
});

describe("EU_VAT_RATES", () => {
  it("should have rates for all 27 EU member states", () => {
    expect(Object.keys(EU_VAT_RATES).length).toBe(27);
  });

  it("should have standard rate for every country", () => {
    Object.values(EU_VAT_RATES).forEach((config) => {
      expect(config.standard).toBeGreaterThan(0);
      expect(config.standard).toBeLessThanOrEqual(27);
      expect(config.name).toBeTruthy();
      expect(config.nameEs).toBeTruthy();
    });
  });
});

describe("getCountryName", () => {
  it("should return country name for valid code", () => {
    expect(getCountryName("ES")).toBe("España");
    expect(getCountryName("DE")).toBe("Alemania");
  });

  it("should be case insensitive", () => {
    expect(getCountryName("es")).toBe("España");
  });

  it("should return code itself for unknown country", () => {
    expect(getCountryName("ZZ")).toBe("ZZ");
  });
});

describe("COUNTRY_LIST", () => {
  it("should include both EU and non-EU countries", () => {
    const euCountries = COUNTRY_LIST.filter((c) => c.isEU);
    const nonEuCountries = COUNTRY_LIST.filter((c) => !c.isEU);

    expect(euCountries.length).toBe(27);
    expect(nonEuCountries.length).toBeGreaterThan(0);
  });

  it("should have GB as non-EU", () => {
    const gb = COUNTRY_LIST.find((c) => c.code === "GB");
    expect(gb).toBeDefined();
    expect(gb?.isEU).toBe(false);
  });
});
