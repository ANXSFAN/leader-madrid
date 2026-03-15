import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  BASE_CURRENCY,
  type SupportedCurrency,
} from "@/lib/currency";
import {
  getExchangeRate,
  convertPrice,
} from "@/lib/services/exchange-rate-service";

// Helper type to avoid fetching user multiple times
type UserContext = {
  id: string;
  b2bStatus: "NOT_APPLIED" | "PENDING" | "APPROVED" | "REJECTED";
  priceLists: { id: string }[];
  customerLevel?: string | null;
};

export interface PriceResult {
  price: number;
  currency: string;
  isManualPrice: boolean;
}

/**
 * Calculates the price for a product variant based on the user's assigned price list.
 */
export async function getProductPrice(
  userId: string | undefined,
  variantId: string,
  quantity: number = 1,
  tx?: Prisma.TransactionClient,
  userContext?: UserContext
): Promise<number> {
  const client = tx || db;

  // 1. Get the variant's base price and b2bPrice first
  const variant = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { price: true, b2bPrice: true },
  });

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  const basePrice = Number(variant.price);

  // If no user, return base price (Guest)
  if (!userId) {
    return basePrice;
  }

  // 2. Get User's Price Lists and B2B Status (if not provided)
  let user = userContext;
  if (!user) {
    const fetchedUser = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        priceLists: { select: { id: true } },
        b2bStatus: true,
        customerLevel: true,
      },
    });
    if (fetchedUser) {
      user = fetchedUser;
    }
  }

  if (!user) {
    return basePrice;
  }

  const levelPriceList = user.customerLevel
    ? await client.priceList.findFirst({
        where: { levelCode: user.customerLevel },
        select: { id: true, discountPercent: true },
      })
    : null;

  // 3. Find applicable rule in the personal price lists
  let priceListPrice: number | null = null;

  // Determine effective price list: personal > default (for B2B approved users with no personal list)
  let effectivePriceListIds: string[] = [];
  let effectiveDiscountPercent = 0;
  if (user.priceLists && user.priceLists.length > 0) {
    effectivePriceListIds = user.priceLists.map((pl) => pl.id);
    // Fetch discountPercent from the first personal price list
    const personalPL = await client.priceList.findUnique({
      where: { id: user.priceLists[0].id },
      select: { discountPercent: true },
    });
    effectiveDiscountPercent = Number(personalPL?.discountPercent || 0);
  } else if (user.b2bStatus === "APPROVED") {
    // Fallback to default price list for B2B customers without a personal one
    const defaultPriceList = await client.priceList.findFirst({
      where: { isDefault: true },
      select: { id: true, discountPercent: true },
    });
    if (defaultPriceList) {
      effectivePriceListIds = [defaultPriceList.id];
      effectiveDiscountPercent = Number(defaultPriceList.discountPercent || 0);
    }
  }

  if (effectivePriceListIds.length > 0) {
    const rule = await client.priceListRule.findFirst({
      where: {
        priceListId: { in: effectivePriceListIds },
        variantId: variantId,
        minQuantity: {
          lte: quantity,
        },
      },
      orderBy: [
        { minQuantity: "desc" }, // Highest quantity break first
        { price: "asc" }, // Then lowest price
      ],
    });

    if (rule) {
      priceListPrice = Number(rule.price);
    } else if (effectiveDiscountPercent > 0) {
      priceListPrice = basePrice * (1 - effectiveDiscountPercent / 100);
    }
  }

  if (priceListPrice !== null) {
    return priceListPrice;
  }

  if (levelPriceList) {
    const levelRule = await client.priceListRule.findFirst({
      where: {
        priceListId: levelPriceList.id,
        variantId: variantId,
        minQuantity: {
          lte: quantity,
        },
      },
      orderBy: [
        { minQuantity: "desc" },
        { price: "asc" },
      ],
    });

    if (levelRule) {
      return Number(levelRule.price);
    }

    const discountPercent = Number(levelPriceList.discountPercent || 0);
    if (discountPercent > 0) {
      return basePrice * (1 - discountPercent / 100);
    }
  }

  // 4. Fallback: If B2B Approved, use b2bPrice (if available)
  if (user.b2bStatus === "APPROVED" && variant.b2bPrice) {
    return Number(variant.b2bPrice);
  }

  // 5. Final Fallback to base price
  return basePrice;
}

/**
 * Currency-aware version of getProductPrice.
 * Returns price in the target currency with manual price detection.
 *
 * Priority for non-EUR currencies:
 * 1. PriceListRule in target currency (manual price) → use directly
 * 2. EUR base price → auto-convert using exchange rate
 */
export async function getProductPriceInCurrency(
  userId: string | undefined,
  variantId: string,
  currency: SupportedCurrency = BASE_CURRENCY,
  quantity: number = 1,
  tx?: Prisma.TransactionClient,
  userContext?: UserContext
): Promise<PriceResult> {
  // Get EUR base price first
  const eurPrice = await getProductPrice(userId, variantId, quantity, tx, userContext);

  if (currency === BASE_CURRENCY) {
    return { price: eurPrice, currency: BASE_CURRENCY, isManualPrice: false };
  }

  // Check for manual price in target currency PriceList
  const client = tx || db;
  const manualRule = await client.priceListRule.findFirst({
    where: {
      priceList: { currency },
      variantId,
      minQuantity: { lte: quantity },
    },
    orderBy: [{ minQuantity: "desc" }, { price: "asc" }],
  });

  if (manualRule) {
    return {
      price: Number(manualRule.price),
      currency,
      isManualPrice: true,
    };
  }

  // Auto-convert from EUR
  const rate = await getExchangeRate(currency);
  return {
    price: convertPrice(eurPrice, currency, rate),
    currency,
    isManualPrice: false,
  };
}

/**
 * Optimized batch fetching for product prices.
 * Reduces DB calls significantly for lists (Home, Category, Search).
 */
export async function getBatchProductPrices(
  userId: string | undefined,
  variantIds: string[],
  tx?: Prisma.TransactionClient
): Promise<Record<string, number>> {
  const client = tx || db;
  const prices: Record<string, number> = {};

  if (!variantIds.length) return prices;

  // 1. Fetch all variants at once
  const variants = await client.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, price: true, b2bPrice: true },
  });

  // Populate base prices initially
  variants.forEach((v) => {
    prices[v.id] = Number(v.price);
  });

  // If no user, we are done (return base prices)
  if (!userId) {
    return prices;
  }

  // 2. Fetch User Context once
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      priceLists: { select: { id: true } },
      b2bStatus: true,
      customerLevel: true,
    },
  });

  if (!user) return prices;

  const levelPriceList = user.customerLevel
    ? await client.priceList.findFirst({
        where: { levelCode: user.customerLevel },
        select: { id: true, discountPercent: true },
      })
    : null;

  if (levelPriceList) {
    const discountPercent = Number(levelPriceList.discountPercent || 0);
    if (discountPercent > 0) {
      variants.forEach((v) => {
        prices[v.id] = Number(v.price) * (1 - discountPercent / 100);
      });
    }

    const levelRules = await client.priceListRule.findMany({
      where: {
        priceListId: levelPriceList.id,
        variantId: { in: variantIds },
        minQuantity: { lte: 1 },
      },
      orderBy: [{ minQuantity: "desc" }, { price: "asc" }],
    });

    const levelRulesByVariant: Record<string, typeof levelRules> = {};
    levelRules.forEach((r) => {
      if (!levelRulesByVariant[r.variantId]) levelRulesByVariant[r.variantId] = [];
      levelRulesByVariant[r.variantId].push(r);
    });

    Object.entries(levelRulesByVariant).forEach(([vId, vRules]) => {
      if (vRules.length > 0) {
        prices[vId] = Number(vRules[0].price);
      }
    });
  }

  // Determine effective price list: personal > default (for B2B approved users with no personal list)
  let effectivePriceListIds: string[] = [];
  let effectiveDiscountPercent = 0;
  if (user.priceLists.length > 0) {
    effectivePriceListIds = user.priceLists.map((pl) => pl.id);
    const personalPL = await client.priceList.findUnique({
      where: { id: user.priceLists[0].id },
      select: { discountPercent: true },
    });
    effectiveDiscountPercent = Number(personalPL?.discountPercent || 0);
  } else if (user.b2bStatus === "APPROVED") {
    const defaultPriceList = await client.priceList.findFirst({
      where: { isDefault: true },
      select: { id: true, discountPercent: true },
    });
    if (defaultPriceList) {
      effectivePriceListIds = [defaultPriceList.id];
      effectiveDiscountPercent = Number(defaultPriceList.discountPercent || 0);
    }
  }

  if (effectivePriceListIds.length > 0) {
    const rules = await client.priceListRule.findMany({
      where: {
        priceListId: { in: effectivePriceListIds },
        variantId: { in: variantIds },
        minQuantity: { lte: 1 },
      },
      orderBy: [{ minQuantity: "desc" }, { price: "asc" }],
    });

    const rulesByVariant: Record<string, typeof rules> = {};
    rules.forEach((r) => {
      if (!rulesByVariant[r.variantId]) rulesByVariant[r.variantId] = [];
      rulesByVariant[r.variantId].push(r);
    });

    // Apply specific rules
    Object.entries(rulesByVariant).forEach(([vId, vRules]) => {
      if (vRules.length > 0) {
        prices[vId] = Number(vRules[0].price);
      }
    });

    // Apply global discount to variants without specific rules
    if (effectiveDiscountPercent > 0) {
      for (const v of variants) {
        if (!rulesByVariant[v.id]) {
          prices[v.id] = Number(v.price) * (1 - effectiveDiscountPercent / 100);
        }
      }
    }
  }

  // 4. If B2B Approved and no PriceList or Level adjustments, use b2bPrice
  if (user.b2bStatus === "APPROVED") {
    variants.forEach((v) => {
      if (v.b2bPrice && prices[v.id] === Number(v.price)) {
        prices[v.id] = Number(v.b2bPrice);
      }
    });
  }

  return prices;
}

/**
 * Currency-aware batch price fetching.
 * Returns prices in the target currency, preferring manual PriceList rules.
 */
export async function getBatchProductPricesInCurrency(
  userId: string | undefined,
  variantIds: string[],
  currency: SupportedCurrency = BASE_CURRENCY,
  tx?: Prisma.TransactionClient
): Promise<Record<string, number>> {
  // Get EUR base prices
  const eurPrices = await getBatchProductPrices(userId, variantIds, tx);

  if (currency === BASE_CURRENCY || !variantIds.length) {
    return eurPrices;
  }

  const client = tx || db;

  // Batch-fetch manual prices in target currency
  const manualRules = await client.priceListRule.findMany({
    where: {
      priceList: { currency },
      variantId: { in: variantIds },
      minQuantity: { lte: 1 },
    },
    orderBy: [{ minQuantity: "desc" }, { price: "asc" }],
  });

  const manualPrices: Record<string, number> = {};
  manualRules.forEach((r) => {
    // Keep only the first (best) match per variant
    if (!(r.variantId in manualPrices)) {
      manualPrices[r.variantId] = Number(r.price);
    }
  });

  // Get exchange rate for auto-conversion
  const rate = await getExchangeRate(currency);

  // Build final prices: manual price if available, else auto-convert
  const prices: Record<string, number> = {};
  for (const variantId of variantIds) {
    if (variantId in manualPrices) {
      prices[variantId] = manualPrices[variantId];
    } else if (variantId in eurPrices) {
      prices[variantId] = convertPrice(eurPrices[variantId], currency, rate);
    }
  }

  return prices;
}
