import {
  SUPPORTED_CURRENCIES,
  BASE_CURRENCY,
  LOCALE_CURRENCY_MAP,
  CURRENCY_INFO,
  isSupportedCurrency,
  convertPrice,
  convertToEUR,
} from "../currency";

describe("currency", () => {
  describe("constants", () => {
    it("should have EUR as base currency", () => {
      expect(BASE_CURRENCY).toBe("EUR");
    });

    it("should support 8 currencies", () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(8);
      expect(SUPPORTED_CURRENCIES).toContain("EUR");
      expect(SUPPORTED_CURRENCIES).toContain("GBP");
      expect(SUPPORTED_CURRENCIES).toContain("PLN");
      expect(SUPPORTED_CURRENCIES).toContain("CHF");
    });

    it("should map all 9 locales to a currency", () => {
      const locales = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "zh"];
      locales.forEach((locale) => {
        expect(LOCALE_CURRENCY_MAP[locale]).toBeDefined();
        expect(SUPPORTED_CURRENCIES).toContain(LOCALE_CURRENCY_MAP[locale]);
      });
    });

    it("should have symbol and nameKey for every supported currency", () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(CURRENCY_INFO[currency]).toBeDefined();
        expect(CURRENCY_INFO[currency].symbol).toBeTruthy();
        expect(CURRENCY_INFO[currency].nameKey).toBeTruthy();
      });
    });
  });

  describe("isSupportedCurrency", () => {
    it("should return true for supported currencies", () => {
      expect(isSupportedCurrency("EUR")).toBe(true);
      expect(isSupportedCurrency("GBP")).toBe(true);
      expect(isSupportedCurrency("PLN")).toBe(true);
    });

    it("should return false for unsupported currencies", () => {
      expect(isSupportedCurrency("USD")).toBe(false);
      expect(isSupportedCurrency("JPY")).toBe(false);
      expect(isSupportedCurrency("")).toBe(false);
      expect(isSupportedCurrency("eur")).toBe(false); // case-sensitive
    });
  });

  describe("convertPrice", () => {
    it("should return original amount for EUR (base currency)", () => {
      expect(convertPrice(100, "EUR", 1.5)).toBe(100);
    });

    it("should convert EUR to target currency using rate", () => {
      // 100 EUR * 0.85 GBP/EUR = 85 GBP
      expect(convertPrice(100, "GBP", 0.85)).toBe(85);
    });

    it("should round to 2 decimal places", () => {
      // 100 EUR * 4.567 PLN/EUR = 456.70 PLN
      expect(convertPrice(100, "PLN", 4.567)).toBe(456.7);
      // 33.33 EUR * 1.0731 = 35.77
      expect(convertPrice(33.33, "CHF", 1.0731)).toBe(35.77);
    });

    it("should handle zero amount", () => {
      expect(convertPrice(0, "GBP", 0.85)).toBe(0);
    });

    it("should handle rate of 1", () => {
      expect(convertPrice(100, "GBP", 1)).toBe(100);
    });
  });

  describe("convertToEUR", () => {
    it("should return original amount for EUR", () => {
      expect(convertToEUR(100, "EUR", 0.85)).toBe(100);
    });

    it("should convert foreign currency to EUR", () => {
      // 85 GBP / 0.85 = 100 EUR
      expect(convertToEUR(85, "GBP", 0.85)).toBe(100);
    });

    it("should round to 2 decimal places", () => {
      expect(convertToEUR(456.7, "PLN", 4.567)).toBe(100);
    });

    it("should handle zero rate by returning original amount", () => {
      expect(convertToEUR(100, "GBP", 0)).toBe(100);
    });

    it("should handle zero amount", () => {
      expect(convertToEUR(0, "GBP", 0.85)).toBe(0);
    });
  });
});
