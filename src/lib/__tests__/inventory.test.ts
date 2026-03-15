/**
 * Inventory logic tests with mocked Prisma transaction.
 * Tests processStockMovement and getBundleStock.
 */

// Mock db
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    bundleItem: { findMany: jest.fn() },
  },
}));

import { processStockMovement, getBundleStock } from "../inventory";
import { InventoryType } from "@prisma/client";
import db from "../db";

describe("getBundleStock", () => {
  const mockBundleItemFindMany = db.bundleItem.findMany as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 0 when no bundle items exist", async () => {
    mockBundleItemFindMany.mockResolvedValue([]);

    const stock = await getBundleStock("prod-bundle");
    expect(stock).toBe(0);
  });

  it("should calculate stock from single component", async () => {
    mockBundleItemFindMany.mockResolvedValue([
      {
        quantity: 2,
        child: { physicalStock: 10, allocatedStock: 0 },
      },
    ]);

    const stock = await getBundleStock("prod-bundle");
    // 10 available / 2 needed = 5 bundles
    expect(stock).toBe(5);
  });

  it("should return minimum across all components", async () => {
    mockBundleItemFindMany.mockResolvedValue([
      {
        quantity: 1,
        child: { physicalStock: 100, allocatedStock: 0 }, // 100 available
      },
      {
        quantity: 3,
        child: { physicalStock: 9, allocatedStock: 0 }, // 9/3 = 3 bundles
      },
      {
        quantity: 2,
        child: { physicalStock: 20, allocatedStock: 10 }, // (20-10)/2 = 5 bundles
      },
    ]);

    const stock = await getBundleStock("prod-bundle");
    // min(100, 3, 5) = 3
    expect(stock).toBe(3);
  });

  it("should account for allocated stock", async () => {
    mockBundleItemFindMany.mockResolvedValue([
      {
        quantity: 1,
        child: { physicalStock: 10, allocatedStock: 7 }, // 3 available
      },
    ]);

    const stock = await getBundleStock("prod-bundle");
    expect(stock).toBe(3);
  });

  it("should return 0 when a component has no available stock", async () => {
    mockBundleItemFindMany.mockResolvedValue([
      {
        quantity: 1,
        child: { physicalStock: 10, allocatedStock: 10 }, // 0 available
      },
    ]);

    const stock = await getBundleStock("prod-bundle");
    expect(stock).toBe(0);
  });
});

describe("processStockMovement", () => {
  let tx: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    tx = {
      productVariant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryTransaction: {
        create: jest.fn(),
      },
      bundleItem: {
        findMany: jest.fn(),
      },
      warehouseStock: {
        upsert: jest.fn(),
      },
    };
  });

  it("should throw when variant not found", async () => {
    tx.productVariant.findUnique.mockResolvedValue(null);

    await expect(
      processStockMovement(tx as any, {
        variantId: "var-nonexistent",
        quantity: 10,
        type: InventoryType.PURCHASE_ORDER,
      })
    ).rejects.toThrow("Variant not found");
  });

  it("should increase physical stock for positive quantity (SIMPLE product)", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      sku: "SKU-001",
      physicalStock: 10,
      allocatedStock: 0,
      product: { id: "prod-1", type: "SIMPLE" },
    });

    await processStockMovement(tx as any, {
      variantId: "var-1",
      quantity: 5,
      type: InventoryType.PURCHASE_ORDER,
      reference: "PO-001",
    });

    // Should create transaction record
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variantId: "var-1",
        quantity: 5,
        type: InventoryType.PURCHASE_ORDER,
        reference: "PO-001",
      }),
    });

    // Should increment physical stock
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var-1" },
      data: { physicalStock: { increment: 5 } },
    });
  });

  it("should throw on insufficient stock for negative quantity", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      sku: "SKU-001",
      physicalStock: 3,
      allocatedStock: 1, // available = 2
      product: { id: "prod-1", type: "SIMPLE" },
    });

    await expect(
      processStockMovement(tx as any, {
        variantId: "var-1",
        quantity: -5, // need 5, only 2 available
        type: InventoryType.SALE_ORDER,
      })
    ).rejects.toThrow("Insufficient stock");
  });

  it("should deduct stock for negative quantity when sufficient", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      sku: "SKU-001",
      physicalStock: 10,
      allocatedStock: 2,
      product: { id: "prod-1", type: "SIMPLE" },
    });

    await processStockMovement(tx as any, {
      variantId: "var-1",
      quantity: -3,
      type: InventoryType.SALE_ORDER,
    });

    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var-1" },
      data: { physicalStock: { increment: -3 } },
    });
  });

  it("should upsert warehouse stock when warehouseId is provided", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-1",
      sku: "SKU-001",
      physicalStock: 10,
      allocatedStock: 0,
      product: { id: "prod-1", type: "SIMPLE" },
    });

    await processStockMovement(tx as any, {
      variantId: "var-1",
      quantity: 5,
      type: InventoryType.PURCHASE_ORDER,
      warehouseId: "wh-1",
    });

    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith({
      where: {
        warehouseId_variantId: { warehouseId: "wh-1", variantId: "var-1" },
      },
      update: { physicalStock: { increment: 5 } },
      create: {
        warehouseId: "wh-1",
        variantId: "var-1",
        physicalStock: 5,
      },
    });
  });

  it("should process bundle components for BUNDLE product", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-bundle",
      sku: "BUNDLE-001",
      physicalStock: 0,
      allocatedStock: 0,
      product: { id: "prod-bundle", type: "BUNDLE" },
    });

    tx.bundleItem.findMany.mockResolvedValue([
      {
        childId: "var-child-1",
        quantity: 2,
        child: { id: "var-child-1", sku: "CHILD-1", physicalStock: 20, allocatedStock: 0 },
      },
      {
        childId: "var-child-2",
        quantity: 1,
        child: { id: "var-child-2", sku: "CHILD-2", physicalStock: 10, allocatedStock: 0 },
      },
    ]);

    await processStockMovement(tx as any, {
      variantId: "var-bundle",
      quantity: -3, // sell 3 bundles
      type: InventoryType.SALE_ORDER,
    });

    // Should create main transaction
    expect(tx.inventoryTransaction.create).toHaveBeenCalledTimes(3); // 1 main + 2 children

    // Should update child-1: -3 * 2 = -6
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var-child-1" },
      data: { physicalStock: { increment: -6 } },
    });

    // Should update child-2: -3 * 1 = -3
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var-child-2" },
      data: { physicalStock: { increment: -3 } },
    });
  });

  it("should throw when bundle component has insufficient stock", async () => {
    tx.productVariant.findUnique.mockResolvedValue({
      id: "var-bundle",
      sku: "BUNDLE-001",
      physicalStock: 0,
      allocatedStock: 0,
      product: { id: "prod-bundle", type: "BUNDLE" },
    });

    tx.bundleItem.findMany.mockResolvedValue([
      {
        childId: "var-child-1",
        quantity: 5,
        child: { id: "var-child-1", sku: "CHILD-1", physicalStock: 8, allocatedStock: 0 },
      },
    ]);

    await expect(
      processStockMovement(tx as any, {
        variantId: "var-bundle",
        quantity: -3, // need 3*5=15, only 8 available
        type: InventoryType.SALE_ORDER,
      })
    ).rejects.toThrow("Insufficient stock for bundle component CHILD-1");
  });
});
