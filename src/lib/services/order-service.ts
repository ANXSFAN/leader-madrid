import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getProductPrice } from "@/lib/pricing";
import { getBundleStock, processStockMovement } from "@/lib/inventory";
import { getLocalized } from "@/lib/content";
import { generateOrderNumber } from "@/lib/utils/order-number";
import { getGlobalConfig } from "@/lib/actions/config";
import { determineVAT, determineVATAsync } from "@/lib/vat";

interface ShippingAddress {
  country?: string;
  city?: string;
  zipCode?: string;
}

const DEFAULT_SHIPPING_CONFIG = {
  freeShippingThreshold: 150,
  baseShippingCost: 9.9,
  shippingPerKg: 1.5,
};

export async function calculateShippingCost(
  subtotal: number,
  address?: ShippingAddress,
  country?: string
): Promise<number> {
  let config = DEFAULT_SHIPPING_CONFIG;

  try {
    const shippingConfig = await getGlobalConfig("shipping");
    if (shippingConfig && typeof shippingConfig === "object") {
      const sc = shippingConfig as Record<string, unknown>;
      config = {
        freeShippingThreshold:
          (sc.freeShippingThreshold as number) ??
          DEFAULT_SHIPPING_CONFIG.freeShippingThreshold,
        baseShippingCost:
          (sc.baseShippingCost as number) ??
          DEFAULT_SHIPPING_CONFIG.baseShippingCost,
        shippingPerKg:
          (sc.shippingPerKg as number) ??
          DEFAULT_SHIPPING_CONFIG.shippingPerKg,
      };
    }
  } catch (e) {}

  if (subtotal >= config.freeShippingThreshold) {
    return 0;
  }

  let shippingCost = config.baseShippingCost;

  if (country && country.toUpperCase() !== "ES") {
    shippingCost += 15;
  }

  return Number(shippingCost.toFixed(2));
}

export interface OrderItemInput {
  variantId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CalculatedOrderItem {
  variantId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productName: string;
  sku: string;
  costPrice: number;
  image?: string;
}

export interface OrderCalculationResult {
  items: CalculatedOrderItem[];
  subtotal: number;
  tax: number;
  vatRate: number;
  isReverseCharge: boolean;
  isExempt: boolean;
  total: number;
  validationErrors: string[];
}

export interface ShippingAddressInput {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zipCode: string;
  country: string;
  phone: string;
}

export interface CreateWebOrderParams {
  userId: string;
  items: OrderItemInput[];
  shippingAddress: ShippingAddressInput;
  paymentMethod: string;
  poNumber?: string;
  vatNumber?: string;
  buyerCountry?: string;
  shippingMethodId?: string;
  currency?: string;
  exchangeRate?: number;
}

export class OrderService {
  static async prepareOrder(
    items: OrderItemInput[],
    userId?: string,
    tx: Prisma.TransactionClient | typeof db = db,
    vatParams?: { buyerCountry: string; vatNumber?: string },
    locale: string = "en"
  ): Promise<OrderCalculationResult> {
    const result: OrderCalculationResult = {
      items: [],
      subtotal: 0,
      tax: 0,
      vatRate: 21,
      isReverseCharge: false,
      isExempt: false,
      total: 0,
      validationErrors: [],
    };

    for (const item of items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });

      if (!variant) {
        result.validationErrors.push(
          `Product variant not found: ${item.variantId}`
        );
        continue;
      }

      if (variant.product.type === "BUNDLE") {
        const available = await getBundleStock(variant.product.id, tx);
        if (available < item.quantity) {
          result.validationErrors.push(
            `Insufficient stock for bundle ${variant.sku} (Available: ${available})`
          );
        }
      } else {
        const available = variant.physicalStock - variant.allocatedStock;
        if (available < item.quantity) {
          result.validationErrors.push(
            `Insufficient stock for product ${variant.sku} (Available: ${available})`
          );
        }
      }

      let unitPrice = item.unitPrice;
      if (unitPrice === undefined) {
        unitPrice = await getProductPrice(
          userId,
          variant.id,
          item.quantity,
          tx
        );
      }

      const itemTotal = unitPrice * item.quantity;
      const productContent = getLocalized(variant.product.content, locale);
      const productName = productContent.name || variant.sku;

      let image = "/placeholder.png";
      if (
        productContent.images &&
        Array.isArray(productContent.images) &&
        productContent.images.length > 0
      ) {
        image = productContent.images[0];
      }

      result.items.push({
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
        productName,
        sku: variant.sku,
        costPrice: Number(variant.costPrice || 0),
        image,
      });

      result.subtotal += itemTotal;
    }

    const vatDetermination = await determineVATAsync({
      subtotal: result.subtotal,
      buyerCountry: vatParams?.buyerCountry ?? "ES",
      buyerVATNumber: vatParams?.vatNumber,
    });

    result.tax = vatDetermination.vatAmount;
    result.vatRate = vatDetermination.vatRate;
    result.isReverseCharge = vatDetermination.isReverseCharge;
    result.isExempt = vatDetermination.isExempt;
    result.total = result.subtotal + result.tax;

    return result;
  }

  static async createWebOrder(params: CreateWebOrderParams) {
    const {
      userId,
      items,
      shippingAddress,
      paymentMethod,
      poNumber,
      vatNumber,
      buyerCountry,
      shippingMethodId,
      currency = "EUR",
      exchangeRate = 1,
    } = params;

    return db.$transaction(async (tx) => {
      let addressId: string;

      const existingAddress = await tx.address.findFirst({
        where: {
          userId,
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          street: shippingAddress.street,
          city: shippingAddress.city,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country,
          phone: shippingAddress.phone,
        },
      });

      if (existingAddress) {
        addressId = existingAddress.id;
      } else {
        const newAddress = await tx.address.create({
          data: {
            userId,
            type: "SHIPPING",
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            street: shippingAddress.street,
            city: shippingAddress.city,
            zipCode: shippingAddress.zipCode,
            country: shippingAddress.country,
            phone: shippingAddress.phone,
          },
        });
        addressId = newAddress.id;
      }

      const effectiveBuyerCountry =
        buyerCountry ?? shippingAddress.country ?? "ES";

      const calculation = await OrderService.prepareOrder(items, userId, tx, {
        buyerCountry: effectiveBuyerCountry,
        vatNumber,
      });

      if (calculation.validationErrors.length > 0) {
        throw new Error(calculation.validationErrors.join(", "));
      }

      const orderNumber = generateOrderNumber("ORD");

      for (const item of calculation.items) {
        // Row-level lock to prevent concurrent overselling
        const [variant] = await tx.$queryRawUnsafe<
          Array<{ id: string; sku: string; productId: string; physicalStock: number; allocatedStock: number }>
        >(
          `SELECT id, sku, "productId", "physicalStock", "allocatedStock" FROM product_variants WHERE id = $1 FOR UPDATE`,
          item.variantId
        );

        if (!variant)
          throw new Error(`Product variant not found: ${item.variantId}`);

        const product = await tx.product.findUnique({
          where: { id: variant.productId },
          select: { id: true, type: true },
        });

        if (!product)
          throw new Error(`Product not found for variant: ${item.variantId}`);

        if (product.type === "BUNDLE") {
          const available = await getBundleStock(product.id, tx);
          if (available < item.quantity) {
            throw new Error(`Insufficient stock for bundle ${variant.sku}`);
          }
        } else {
          const available = variant.physicalStock - variant.allocatedStock;
          if (available < item.quantity) {
            throw new Error(`Insufficient stock for product ${variant.sku}`);
          }
        }

        // We don't deduct physical stock here anymore (only when shipped)
        // Instead, we increase allocatedStock
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            allocatedStock: { increment: item.quantity },
          },
        });

        // For BUNDLE products, also allocate stock for sub-components
        if (product.type === "BUNDLE") {
          const bundleItems = await tx.bundleItem.findMany({
            where: { parentId: product.id },
            include: { child: { select: { id: true, sku: true, physicalStock: true, allocatedStock: true } } },
          });
          for (const bi of bundleItems) {
            // Lock and validate each child component before allocating
            const [child] = await tx.$queryRawUnsafe<
              Array<{ id: string; physicalStock: number; allocatedStock: number }>
            >(
              `SELECT id, "physicalStock", "allocatedStock" FROM product_variants WHERE id = $1 FOR UPDATE`,
              bi.childId
            );
            const needed = item.quantity * bi.quantity;
            const childAvailable = (child?.physicalStock ?? 0) - (child?.allocatedStock ?? 0);
            if (childAvailable < needed) {
              throw new Error(
                `Insufficient stock for bundle component ${bi.child.sku} (Available: ${childAvailable}, Required: ${needed})`
              );
            }
            await tx.productVariant.update({
              where: { id: bi.childId },
              data: {
                allocatedStock: { increment: needed },
              },
            });
          }
        }
      }

      let shippingCost = await calculateShippingCost(
        calculation.subtotal,
        undefined,
        shippingAddress.country
      );
      let resolvedShippingMethodId: string | undefined = undefined;

      if (shippingMethodId) {
        const method = await tx.shippingMethod.findUnique({
          where: { id: shippingMethodId },
        });

        if (!method) {
          throw new Error("Shipping method not found");
        }

        shippingCost = Number(method.price);
        resolvedShippingMethodId = method.id;
      }
      // Apply VAT to shipping cost (shipping is taxed at the same rate as goods)
      const shippingTax = shippingCost * calculation.vatRate / 100;
      const total = calculation.total + shippingCost + shippingTax;

      const newOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          subtotal: calculation.subtotal,
          tax: calculation.tax + shippingTax,
          shipping: shippingCost,
          total,
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentMethod,
          poNumber,
          vatRate: calculation.vatRate,
          isReverseCharge: calculation.isReverseCharge,
          buyerVatNumber: vatNumber ?? null,
          currency,
          exchangeRate,
          shippingAddressId: addressId,
          shippingMethodId: resolvedShippingMethodId,
          items: {
            create: calculation.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.unitPrice,
              costPrice: item.costPrice,
              total: item.total,
              name: item.productName,
              sku: item.sku,
              image: item.image,
            })),
          },
        },
      });

      await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: userId,
          status: "DRAFT",
          totalAmount: total,
          subtotal: calculation.subtotal,
          tax: calculation.tax + shippingTax,
          shipping: shippingCost,
          currency,
          exchangeRate,
          shippingMethodId: resolvedShippingMethodId,
          items: {
            create: calculation.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              total: item.total,
              name: item.productName,
              sku: item.sku,
              image: item.image,
            })),
          },
        },
      });

      // Clear the user's cart within the transaction
      // If order creation fails, the transaction rollback will preserve the cart
      await tx.cartItem.deleteMany({ where: { cart: { userId } } });
      await tx.cart.deleteMany({ where: { userId } });

      return { success: true, orderId: newOrder.id, orderNumber };
    });
  }
}
