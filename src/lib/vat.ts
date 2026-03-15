export interface VATCountryConfig {
  standard: number;
  reduced?: number;
  name: string;
  nameEs: string;
}

export const EU_VAT_RATES: Record<string, VATCountryConfig> = {
  AT: { standard: 20, reduced: 13, name: "Austria", nameEs: "Austria" },
  BE: { standard: 21, reduced: 12, name: "Belgium", nameEs: "Bélgica" },
  BG: { standard: 20, reduced: 9, name: "Bulgaria", nameEs: "Bulgaria" },
  CY: { standard: 19, reduced: 9, name: "Cyprus", nameEs: "Chipre" },
  CZ: { standard: 21, reduced: 15, name: "Czech Republic", nameEs: "República Checa" },
  DE: { standard: 19, reduced: 7, name: "Germany", nameEs: "Alemania" },
  DK: { standard: 25, name: "Denmark", nameEs: "Dinamarca" },
  EE: { standard: 22, reduced: 9, name: "Estonia", nameEs: "Estonia" },
  ES: { standard: 21, reduced: 10, name: "Spain", nameEs: "España" },
  FI: { standard: 24, reduced: 14, name: "Finland", nameEs: "Finlandia" },
  FR: { standard: 20, reduced: 10, name: "France", nameEs: "Francia" },
  GR: { standard: 24, reduced: 13, name: "Greece", nameEs: "Grecia" },
  HR: { standard: 25, reduced: 13, name: "Croatia", nameEs: "Croacia" },
  HU: { standard: 27, reduced: 18, name: "Hungary", nameEs: "Hungría" },
  IE: { standard: 23, reduced: 13.5, name: "Ireland", nameEs: "Irlanda" },
  IT: { standard: 22, reduced: 10, name: "Italy", nameEs: "Italia" },
  LT: { standard: 21, reduced: 9, name: "Lithuania", nameEs: "Lituania" },
  LU: { standard: 17, reduced: 14, name: "Luxembourg", nameEs: "Luxemburgo" },
  LV: { standard: 21, reduced: 12, name: "Latvia", nameEs: "Letonia" },
  MT: { standard: 18, reduced: 7, name: "Malta", nameEs: "Malta" },
  NL: { standard: 21, reduced: 9, name: "Netherlands", nameEs: "Países Bajos" },
  PL: { standard: 23, reduced: 8, name: "Poland", nameEs: "Polonia" },
  PT: { standard: 23, reduced: 13, name: "Portugal", nameEs: "Portugal" },
  RO: { standard: 19, reduced: 9, name: "Romania", nameEs: "Rumanía" },
  SE: { standard: 25, reduced: 12, name: "Sweden", nameEs: "Suecia" },
  SI: { standard: 22, reduced: 9.5, name: "Slovenia", nameEs: "Eslovenia" },
  SK: { standard: 20, reduced: 10, name: "Slovakia", nameEs: "Eslovaquia" },
};

export const EU_COUNTRY_CODES = new Set(Object.keys(EU_VAT_RATES));

const SELLER_COUNTRY = "ES";

export interface VATDetermination {
  vatRate: number;
  vatAmount: number;
  isReverseCharge: boolean;
  isExempt: boolean;
  vatLabel: string;
  vatLabelEs: string;
  legalNote?: string;
  legalNoteEs?: string;
}

export function determineVAT(params: {
  subtotal: number;
  buyerCountry: string;
  buyerVATNumber?: string;
  sellerCountry?: string;
}): VATDetermination {
  const { subtotal, buyerVATNumber, sellerCountry = SELLER_COUNTRY } = params;
  const buyerCountry = params.buyerCountry.toUpperCase().trim();
  const sellerCountryUpper = sellerCountry.toUpperCase();
  const isEUBuyer = EU_COUNTRY_CODES.has(buyerCountry);
  const isDomestic = buyerCountry === sellerCountryUpper;
  const hasVATNumber = !!(buyerVATNumber?.trim());

  if (isDomestic) {
    // Spain → Spain: apply Spain's standard rate
    const vatRate = EU_VAT_RATES[sellerCountryUpper]?.standard ?? 21;
    return {
      vatRate,
      vatAmount: Number((subtotal * vatRate / 100).toFixed(2)),
      isReverseCharge: false,
      isExempt: false,
      vatLabel: `VAT ${vatRate}% (IVA)`,
      vatLabelEs: `IVA ${vatRate}%`,
    };
  }

  if (isEUBuyer && hasVATNumber) {
    return {
      vatRate: 0,
      vatAmount: 0,
      isReverseCharge: true,
      isExempt: false,
      vatLabel: "Reverse Charge (0%)",
      vatLabelEs: "Inversión del Sujeto Pasivo (0%)",
      legalNote: "VAT exempt – Reverse Charge Mechanism applies (Art. 194 VAT Directive 2006/112/EC).",
      legalNoteEs: "Exento de IVA. Inversión del sujeto pasivo según art. 84 Ley 37/1992 del IVA y art. 194 Directiva 2006/112/CE.",
    };
  }

  if (isEUBuyer && !hasVATNumber) {
    // B2C intra-EU: apply the destination country's standard rate (EU OSS rules)
    const vatRate = EU_VAT_RATES[buyerCountry]?.standard ?? 21;
    return {
      vatRate,
      vatAmount: Number((subtotal * vatRate / 100).toFixed(2)),
      isReverseCharge: false,
      isExempt: false,
      vatLabel: `VAT ${vatRate}%`,
      vatLabelEs: `IVA ${vatRate}%`,
    };
  }

  return {
    vatRate: 0,
    vatAmount: 0,
    isReverseCharge: false,
    isExempt: true,
    vatLabel: "VAT Exempt (Export)",
    vatLabelEs: "Exento de IVA (Exportación)",
    legalNote: "VAT exempt – Export outside EU (Art. 21 LIVA).",
    legalNoteEs: "Exento de IVA por exportación fuera de la UE según art. 21 Ley 37/1992 del IVA.",
  };
}

/**
 * Async version that checks database VAT config first, falls back to hardcoded rates.
 * Use this for order creation and checkout calculations on the server side.
 */
export async function determineVATAsync(params: {
  subtotal: number;
  buyerCountry: string;
  buyerVATNumber?: string;
  sellerCountry?: string;
}): Promise<VATDetermination> {
  try {
    const { getGlobalConfig } = await import("@/lib/actions/config");
    const vatConfig = await getGlobalConfig("vat");

    if (vatConfig && typeof vatConfig === "object") {
      const config = vatConfig as Record<string, any>;
      const buyerCountry = params.buyerCountry?.toUpperCase().trim() || "ES";
      const sellerCountry = (params.sellerCountry || SELLER_COUNTRY).toUpperCase();
      const isEUBuyer = EU_COUNTRY_CODES.has(buyerCountry);
      const isDomestic = buyerCountry === sellerCountry;
      const hasVATNumber = !!(params.buyerVATNumber?.trim());

      // Check if there's a specific rate for this country
      const countryRate = config.rates?.[buyerCountry];
      const defaultRate = config.defaultRate ?? null;

      if (countryRate !== undefined || defaultRate !== undefined) {
        // EU B2B with VAT number (not domestic): reverse charge
        if (isEUBuyer && hasVATNumber && !isDomestic) {
          return {
            vatRate: 0,
            vatAmount: 0,
            isReverseCharge: true,
            isExempt: false,
            vatLabel: "Reverse Charge (0%)",
            vatLabelEs: "Inversión del Sujeto Pasivo (0%)",
            legalNote: "VAT exempt – Reverse Charge Mechanism applies (Art. 194 VAT Directive 2006/112/EC).",
            legalNoteEs: "Exento de IVA. Inversión del sujeto pasivo según art. 84 Ley 37/1992 del IVA y art. 194 Directiva 2006/112/CE.",
          };
        }

        // Non-EU: exempt (export)
        if (!isEUBuyer) {
          return {
            vatRate: 0,
            vatAmount: 0,
            isReverseCharge: false,
            isExempt: true,
            vatLabel: "VAT Exempt (Export)",
            vatLabelEs: "Exento de IVA (Exportación)",
            legalNote: "VAT exempt – Export outside EU (Art. 21 LIVA).",
            legalNoteEs: "Exento de IVA por exportación fuera de la UE según art. 21 Ley 37/1992 del IVA.",
          };
        }

        // Domestic or EU B2C: apply rate from DB config
        const rate = countryRate ?? defaultRate;
        const vatAmount = Number((params.subtotal * rate / 100).toFixed(2));
        return {
          vatRate: rate,
          vatAmount,
          isReverseCharge: false,
          isExempt: false,
          vatLabel: isDomestic ? `VAT ${rate}% (IVA)` : `VAT ${rate}%`,
          vatLabelEs: isDomestic ? `IVA ${rate}%` : `IVA ${rate}%`,
        };
      }
    }
  } catch (e) {
    // DB config unavailable, fall through to hardcoded
  }

  // Fallback to hardcoded rates
  return determineVAT(params);
}

export function validateEUVATFormat(vatNumber: string): {
  valid: boolean;
  countryCode: string;
  message?: string;
} {
  if (!vatNumber?.trim()) {
    return { valid: false, countryCode: "", message: "VAT number is required" };
  }

  const cleaned = vatNumber.replace(/[\s\-\.]/g, "").toUpperCase();

  if (cleaned.length < 4) {
    return { valid: false, countryCode: "", message: "VAT number too short" };
  }

  const countryCode = cleaned.substring(0, 2);
  const number = cleaned.substring(2);

  if (!EU_COUNTRY_CODES.has(countryCode)) {
    return { valid: false, countryCode, message: "Not a valid EU country code" };
  }

  if (number.length < 2 || number.length > 13) {
    return { valid: false, countryCode, message: "Invalid VAT number length" };
  }

  const patterns: Record<string, RegExp> = {
    ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
    DE: /^\d{9}$/,
    FR: /^[A-Z0-9]{2}\d{9}$/,
    IT: /^\d{11}$/,
    NL: /^\d{9}B\d{2}$/,
    BE: /^[01]\d{9}$/,
    PL: /^\d{10}$/,
    PT: /^\d{9}$/,
    AT: /^U\d{8}$/,
    SE: /^\d{12}$/,
    DK: /^\d{8}$/,
    FI: /^\d{8}$/,
    GR: /^\d{9}$/,
    HU: /^\d{8}$/,
    IE: /^\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
    LU: /^\d{8}$/,
    RO: /^\d{2,10}$/,
  };

  const pattern = patterns[countryCode];
  if (pattern && !pattern.test(number)) {
    return { valid: false, countryCode, message: `Invalid ${countryCode} VAT number format` };
  }

  return { valid: true, countryCode };
}

export async function checkVIES(
  vatNumber: string
): Promise<{ isValid: boolean; name?: string; address?: string } | null> {
  const cleaned = vatNumber.replace(/[\s\-\.]/g, "").toUpperCase();
  const countryCode = cleaned.substring(0, 2);
  const number = cleaned.substring(2);

  try {
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${number}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      isValid: data.isValid === true,
      name: data.name,
      address: data.address,
    };
  } catch {
    return null;
  }
}

export const COUNTRY_LIST: { code: string; name: string; isEU: boolean }[] = [
  { code: "ES", name: "España", isEU: true },
  { code: "AT", name: "Austria", isEU: true },
  { code: "BE", name: "Bélgica", isEU: true },
  { code: "BG", name: "Bulgaria", isEU: true },
  { code: "CY", name: "Chipre", isEU: true },
  { code: "CZ", name: "República Checa", isEU: true },
  { code: "DE", name: "Alemania", isEU: true },
  { code: "DK", name: "Dinamarca", isEU: true },
  { code: "EE", name: "Estonia", isEU: true },
  { code: "FI", name: "Finlandia", isEU: true },
  { code: "FR", name: "Francia", isEU: true },
  { code: "GR", name: "Grecia", isEU: true },
  { code: "HR", name: "Croacia", isEU: true },
  { code: "HU", name: "Hungría", isEU: true },
  { code: "IE", name: "Irlanda", isEU: true },
  { code: "IT", name: "Italia", isEU: true },
  { code: "LT", name: "Lituania", isEU: true },
  { code: "LU", name: "Luxemburgo", isEU: true },
  { code: "LV", name: "Letonia", isEU: true },
  { code: "MT", name: "Malta", isEU: true },
  { code: "NL", name: "Países Bajos", isEU: true },
  { code: "PL", name: "Polonia", isEU: true },
  { code: "PT", name: "Portugal", isEU: true },
  { code: "RO", name: "Rumanía", isEU: true },
  { code: "SE", name: "Suecia", isEU: true },
  { code: "SI", name: "Eslovenia", isEU: true },
  { code: "SK", name: "Eslovaquia", isEU: true },
  { code: "GB", name: "Reino Unido", isEU: false },
  { code: "NO", name: "Noruega", isEU: false },
  { code: "CH", name: "Suiza", isEU: false },
  { code: "MA", name: "Marruecos", isEU: false },
  { code: "US", name: "Estados Unidos", isEU: false },
  { code: "CA", name: "Canadá", isEU: false },
  { code: "MX", name: "México", isEU: false },
  { code: "AU", name: "Australia", isEU: false },
  { code: "CN", name: "China", isEU: false },
];

export function getCountryName(code: string): string {
  const country = COUNTRY_LIST.find((c) => c.code === code.toUpperCase());
  return country?.name ?? code;
}
