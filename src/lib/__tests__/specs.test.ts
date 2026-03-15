import { getMergedSpecs } from "../specs";
import { Product, ProductVariant, AttributeDefinition } from "@prisma/client";

// Minimal mock factories
function mockProduct(content: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    slug: "test-product",
    sku: "SKU-001",
    type: "SIMPLE",
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryId: null,
  } as unknown as Product;
}

function mockVariant(specs: Record<string, unknown> = {}) {
  return {
    id: "var-1",
    productId: "prod-1",
    sku: "SKU-001-A",
    price: 100,
    b2bPrice: null,
    physicalStock: 10,
    allocatedStock: 0,
    specs,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ProductVariant;
}

function mockAttrDef(key: string, names: Record<string, string>, unit?: string) {
  return {
    id: `attr-${key}`,
    key,
    name: names,
    unit: unit || null,
    type: "TEXT",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AttributeDefinition;
}

describe("getMergedSpecs", () => {
  const definitions: AttributeDefinition[] = [
    mockAttrDef("power", { en: "Power", es: "Potencia" }, "W"),
    mockAttrDef("cct", { en: "Color Temperature", es: "Temperatura de Color" }, "K"),
    mockAttrDef("cri", { en: "CRI", es: "CRI" }),
  ];

  it("should return product specs when no variant specs", () => {
    const product = mockProduct({ specs: { power: "60", cri: "90" } });
    const variant = mockVariant({});

    const result = getMergedSpecs(product, variant, definitions, "en");

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.key === "power")?.displayValue).toBe("60 W");
    expect(result.find((s) => s.key === "cri")?.displayValue).toBe("90");
  });

  it("should let variant specs override product specs", () => {
    const product = mockProduct({ specs: { power: "60", cct: "4000" } });
    const variant = mockVariant({ power: "80" }); // override

    const result = getMergedSpecs(product, variant, definitions, "en");

    const powerSpec = result.find((s) => s.key === "power");
    expect(powerSpec?.value).toBe("80"); // variant wins
    expect(powerSpec?.displayValue).toBe("80 W");

    const cctSpec = result.find((s) => s.key === "cct");
    expect(cctSpec?.value).toBe("4000"); // from product
  });

  it("should merge specs from both sources", () => {
    const product = mockProduct({ specs: { power: "60" } });
    const variant = mockVariant({ cct: "5000" });

    const result = getMergedSpecs(product, variant, definitions, "en");

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.key === "power")).toBeDefined();
    expect(result.find((s) => s.key === "cct")).toBeDefined();
  });

  it("should use localized labels", () => {
    const product = mockProduct({ specs: { power: "60" } });
    const variant = mockVariant({});

    const en = getMergedSpecs(product, variant, definitions, "en");
    expect(en[0].label).toBe("Power");

    const es = getMergedSpecs(product, variant, definitions, "es");
    expect(es[0].label).toBe("Potencia");
  });

  it("should capitalize key as fallback when no definition found", () => {
    const product = mockProduct({ specs: { lumens: "5000" } });
    const variant = mockVariant({});

    const result = getMergedSpecs(product, variant, definitions, "en");

    expect(result[0].label).toBe("Lumens");
    expect(result[0].unit).toBeUndefined();
  });

  it("should skip specs with falsy values", () => {
    const product = mockProduct({ specs: { power: "", cri: null } });
    const variant = mockVariant({});

    const result = getMergedSpecs(product, variant, definitions, "en");

    expect(result).toHaveLength(0);
  });

  it("should handle empty specs on both sides", () => {
    const product = mockProduct({});
    const variant = mockVariant({});

    const result = getMergedSpecs(product, variant, definitions, "en");

    expect(result).toHaveLength(0);
  });
});
