import { generateOrderNumber } from "../utils/order-number";

describe("generateOrderNumber", () => {
  it("should generate ORD prefix by default", () => {
    const num = generateOrderNumber();
    expect(num).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
  });

  it("should generate with SO prefix", () => {
    const num = generateOrderNumber("SO");
    expect(num.startsWith("SO-")).toBe(true);
  });

  it("should generate with PO prefix", () => {
    const num = generateOrderNumber("PO");
    expect(num.startsWith("PO-")).toBe(true);
  });

  it("should generate with ST prefix", () => {
    const num = generateOrderNumber("ST");
    expect(num.startsWith("ST-")).toBe(true);
  });

  it("should include today's date in YYYYMMDD format", () => {
    const num = generateOrderNumber();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    expect(num).toContain(today);
  });

  it("should generate unique numbers", () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateOrderNumber());
    }
    // With 6 random chars (36^6 = ~2B possibilities), collisions in 100 runs are extremely unlikely
    expect(numbers.size).toBe(100);
  });
});
