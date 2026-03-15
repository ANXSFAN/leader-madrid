import { AttributeDefinition, Product, ProductVariant } from "@prisma/client";

export interface MergedSpec {
  key: string;
  label: string;
  value: string;
  unit?: string;
  displayValue: string;
}

/**
 * Merges product and variant specs based on attribute definitions.
 * Variant specs take precedence over product specs.
 *
 * @param product The product object containing global specs in content.specs
 * @param variant The variant object containing specific specs in specs
 * @param definitions List of attribute definitions to look up labels and units
 * @param locale Current locale code (e.g., 'en', 'es')
 * @returns Array of merged specs with localized labels
 */
export function getMergedSpecs(
  product: Product,
  variant: ProductVariant,
  definitions: AttributeDefinition[],
  locale: string = "en"
): MergedSpec[] {
  const productSpecs = ((product.content as Record<string, unknown>)?.specs as Record<string, unknown>) || {};
  const variantSpecs = (variant.specs as Record<string, unknown>) || {};

  // Merge keys from both sources
  const allKeys = new Set([
    ...Object.keys(productSpecs),
    ...Object.keys(variantSpecs),
  ]);

  const merged: MergedSpec[] = [];

  allKeys.forEach((key) => {
    // Variant takes precedence
    const rawValue = variantSpecs[key] || productSpecs[key];

    if (!rawValue) return;

    // Find definition
    const def = definitions.find((d) => d.key === key);

    // Get localized label or fallback to key (Capitalized)
    let label = key.charAt(0).toUpperCase() + key.slice(1);
    let unit = "";

    if (def) {
      const localizedName = (def.name as Record<string, string> | null)?.[locale];
      if (localizedName) {
        label = localizedName;
      }
      if (def.unit) {
        unit = def.unit;
      }
    }

    merged.push({
      key,
      label,
      value: String(rawValue), // Keep raw value separate
      unit: unit || undefined,
      displayValue: String(rawValue) + (unit ? ` ${unit}` : ""),
    });
  });

  return merged;
}
