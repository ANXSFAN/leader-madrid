import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function processStockMovement(
  tx: any, // Use any to avoid strict type checks against potentially outdated client types
  data: {
    variantId: string;
    quantity: number; // Positive for IN, Negative for OUT
    type: string; // Use string for enum
    reference?: string;
    note?: string;
  }
) {
  const { variantId, quantity, type, reference, note } = data;

  // 1. Get Variant with Product Type
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: { id: true, type: true },
      },
    },
  });

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  // 2. Create Transaction for the Main Item (Bundle or Simple)
  await tx.inventoryTransaction.create({
    data: {
      variantId,
      quantity,
      type,
      reference,
      note,
    },
  });

  // 3. Handle Stock Updates
  // Use string comparison for "BUNDLE" to be safe
  if (variant.product.type === "BUNDLE") {
    // For Bundles: Don't update the bundle's own stock (it's virtual).
    // Instead, update components and record their transactions.

    const bundleItems = await tx.bundleItem.findMany({
      where: { parentId: variant.product.id },
    });

    for (const item of bundleItems) {
      // Calculate child quantity change
      const childChange = quantity * item.quantity;

      // Update child stock
      await tx.productVariant.update({
        where: { id: item.childId },
        data: {
          physicalStock: {
            increment: childChange,
          },
        },
      });

      // Create Transaction for Child
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.childId,
          quantity: childChange,
          type,
          reference,
          note: note
            ? `${note} (Bundle Component)`
            : `Bundle Component of ${variant.sku}`,
        },
      });
    }
  } else {
    // For Simple Products: Update stock directly
    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        physicalStock: {
          increment: quantity,
        },
      },
    });
  }
}

async function main() {
  console.log("Starting standalone inventory test...");

  try {
    const uniqueSuffix = Math.random().toString(36).substring(7);
    const skuA = `TEST-A-${uniqueSuffix}`;
    const skuB = `TEST-B-${uniqueSuffix}`;
    const skuBundle = `TEST-BUNDLE-${uniqueSuffix}`;

    console.log(`Creating test products with suffix: ${uniqueSuffix}`);

    // Create Product A
    const productA = await prisma.product.create({
      data: {
        slug: `test-a-${uniqueSuffix}`,
        sku: skuA,
        // type: "SIMPLE", // Default
        content: { name: "Test Product A" },
        variants: {
          create: {
            sku: skuA,
            price: 10,
            physicalStock: 100,
            minStock: 10,
            specs: {},
          },
        },
      },
      include: { variants: true },
    });
    console.log(`Product A created: ${productA.id}`);

    // Create Product B
    const productB = await prisma.product.create({
      data: {
        slug: `test-b-${uniqueSuffix}`,
        sku: skuB,
        // type: "SIMPLE", // Default
        content: { name: "Test Product B" },
        variants: {
          create: {
            sku: skuB,
            price: 20,
            physicalStock: 100,
            minStock: 10,
            specs: {},
          },
        },
      },
      include: { variants: true },
    });
    console.log(`Product B created: ${productB.id}`);

    // Create Bundle Product
    const bundleProduct = await prisma.product.create({
      data: {
        slug: `test-bundle-${uniqueSuffix}`,
        sku: skuBundle,
        type: "BUNDLE" as any,
        content: { name: "Test Bundle" },
        variants: {
          create: {
            sku: skuBundle,
            price: 25,
            physicalStock: 0,
            minStock: 0,
            specs: {},
          },
        },
      },
      include: { variants: true },
    });
    console.log(`Bundle created: ${bundleProduct.id}`);

    // Add Bundle Components
    await prisma.bundleItem.createMany({
      data: [
        {
          parentId: bundleProduct.id,
          childId: productA.variants[0].id,
          quantity: 1,
        },
        {
          parentId: bundleProduct.id,
          childId: productB.variants[0].id,
          quantity: 2,
        },
      ],
    });
    console.log("Bundle components added");

    // Test Scenarios

    // 1. Sales Order (Stock Out)
    console.log("\n--- Scenario 1: Sales Order (Stock Out) ---");
    console.log("Selling 2 Bundles...");
    await prisma.$transaction(async (tx) => {
      await processStockMovement(tx, {
        variantId: bundleProduct.variants[0].id,
        quantity: -2,
        type: "SALE_ORDER",
        reference: "SO-TEST-001",
        note: "Test Sales Order",
      });
    });
    console.log("Sales Order processed.");

    // Verify Stock
    const updatedVariantA = await prisma.productVariant.findUnique({
      where: { id: productA.variants[0].id },
    });
    const updatedVariantB = await prisma.productVariant.findUnique({
      where: { id: productB.variants[0].id },
    });

    console.log(
      `Product A Stock: ${updatedVariantA?.physicalStock} (Expected: 100 - 2*1 = 98)`
    );
    console.log(
      `Product B Stock: ${updatedVariantB?.physicalStock} (Expected: 100 - 2*2 = 96)`
    );

    // 2. Purchase Order (Stock In)
    console.log("\n--- Scenario 2: Purchase Order (Stock In) ---");
    console.log("Receiving 5 Product A...");
    await prisma.$transaction(async (tx) => {
      await processStockMovement(tx, {
        variantId: productA.variants[0].id,
        quantity: 5,
        type: "PURCHASE_ORDER",
        reference: "PO-TEST-001",
        note: "Test Purchase Order",
      });
    });
    console.log("Purchase Order processed.");

    const receivedVariantA = await prisma.productVariant.findUnique({
      where: { id: productA.variants[0].id },
    });
    console.log(
      `Product A Stock: ${receivedVariantA?.physicalStock} (Expected: 98 + 5 = 103)`
    );

    // 3. Manual Adjustment
    console.log("\n--- Scenario 3: Manual Adjustment ---");
    console.log("Adjusting Bundle Stock (Should affect components)...");
    // Note: Adjusting bundle stock directly is unusual but logic supports it
    await prisma.$transaction(async (tx) => {
      await processStockMovement(tx, {
        variantId: bundleProduct.variants[0].id,
        quantity: 1, // Adding 1 Bundle manually (found one?)
        type: "ADJUSTMENT",
        reference: "ADJ-TEST-001",
        note: "Found a bundle",
      });
    });
    console.log("Manual Adjustment processed.");

    const adjustedVariantA = await prisma.productVariant.findUnique({
      where: { id: productA.variants[0].id },
    });
    const adjustedVariantB = await prisma.productVariant.findUnique({
      where: { id: productB.variants[0].id },
    });

    console.log(
      `Product A Stock: ${adjustedVariantA?.physicalStock} (Expected: 103 + 1*1 = 104)`
    );
    console.log(
      `Product B Stock: ${adjustedVariantB?.physicalStock} (Expected: 96 + 1*2 = 98)`
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
