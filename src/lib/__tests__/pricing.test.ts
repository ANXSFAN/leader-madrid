/**
 * Pricing logic tests with mocked Prisma client.
 * Tests the core price resolution chain:
 *   PriceListRule (personal) > PriceList discount > PriceListRule (level) > Level discount > b2bPrice > basePrice
 */

const mockVariantFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockPriceListFindFirst = jest.fn();
const mockPriceListFindUnique = jest.fn();
const mockPriceListRuleFindFirst = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    productVariant: { findUnique: (...args: unknown[]) => mockVariantFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    priceList: {
      findFirst: (...args: unknown[]) => mockPriceListFindFirst(...args),
      findUnique: (...args: unknown[]) => mockPriceListFindUnique(...args),
    },
    priceListRule: {
      findFirst: (...args: unknown[]) => mockPriceListRuleFindFirst(...args),
    },
  },
}));

import { getProductPrice } from "../pricing";

describe("getProductPrice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const variant = { price: 100, b2bPrice: 80 };

  it("should return base price for guest (no userId)", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);

    const price = await getProductPrice(undefined, "var-1");
    expect(price).toBe(100);
  });

  it("should return base price when user not found", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);
    mockUserFindUnique.mockResolvedValueOnce(null);

    const price = await getProductPrice("user-1", "var-1");
    expect(price).toBe(100);
  });

  it("should throw when variant not found", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(null);

    await expect(getProductPrice("user-1", "var-nonexistent")).rejects.toThrow(
      "Variant not found"
    );
  });

  it("should return b2bPrice for approved B2B user without price list", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [],
      b2bStatus: "APPROVED",
      customerLevel: null,
    });

    // No default price list
    mockPriceListFindFirst.mockResolvedValueOnce(null);

    const price = await getProductPrice("user-1", "var-1");
    expect(price).toBe(80); // b2bPrice
  });

  it("should return base price for non-B2B user without price list", async () => {
    const variantNoBb = { price: 100, b2bPrice: null };
    mockVariantFindUnique.mockResolvedValueOnce(variantNoBb);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [],
      b2bStatus: "NOT_APPLIED",
      customerLevel: null,
    });

    const price = await getProductPrice("user-1", "var-1");
    expect(price).toBe(100);
  });

  it("should apply PriceListRule when user has personal price list", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [{ id: "pl-1" }],
      b2bStatus: "APPROVED",
      customerLevel: null,
    });

    // personalPL discountPercent
    mockPriceListFindUnique.mockResolvedValueOnce({ discountPercent: 0 });

    // PriceListRule found with specific price
    mockPriceListRuleFindFirst.mockResolvedValueOnce({ price: 75 });

    const price = await getProductPrice("user-1", "var-1");
    expect(price).toBe(75);
  });

  it("should apply global discount when no specific rule found", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [{ id: "pl-1" }],
      b2bStatus: "APPROVED",
      customerLevel: null,
    });

    // personalPL with 15% discount
    mockPriceListFindUnique.mockResolvedValueOnce({ discountPercent: 15 });

    // No specific rule
    mockPriceListRuleFindFirst.mockResolvedValueOnce(null);

    const price = await getProductPrice("user-1", "var-1");
    // 100 * (1 - 15/100) = 85
    expect(price).toBe(85);
  });

  it("should use default price list for B2B without personal list", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant);
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [],
      b2bStatus: "APPROVED",
      customerLevel: null,
    });

    // Default price list with 10% discount
    mockPriceListFindFirst.mockResolvedValueOnce({
      id: "pl-default",
      discountPercent: 10,
    });

    // No specific rule for this variant
    mockPriceListRuleFindFirst.mockResolvedValueOnce(null);

    const price = await getProductPrice("user-1", "var-1");
    // 100 * (1 - 10/100) = 90
    expect(price).toBe(90);
  });

  it("should prefer personal price list over b2bPrice", async () => {
    mockVariantFindUnique.mockResolvedValueOnce(variant); // b2bPrice = 80
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      priceLists: [{ id: "pl-1" }],
      b2bStatus: "APPROVED",
      customerLevel: null,
    });

    mockPriceListFindUnique.mockResolvedValueOnce({ discountPercent: 0 });

    // Rule gives even better price than b2bPrice
    mockPriceListRuleFindFirst.mockResolvedValueOnce({ price: 70 });

    const price = await getProductPrice("user-1", "var-1");
    expect(price).toBe(70); // rule price, not b2bPrice (80)
  });
});
