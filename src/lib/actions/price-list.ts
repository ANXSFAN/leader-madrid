"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";

const priceListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  currency: z.string().default("EUR"),
  isDefault: z.boolean().default(false),
  levelCode: z.string().optional().nullable(),
  discountPercent: z.number().min(0).max(100).default(0),
});

const priceListRuleSchema = z.object({
  priceListId: z.string().min(1),
  variantId: z.string().min(1),
  price: z.number().min(0),
  minQuantity: z.number().int().min(1).default(1),
});

export async function getPriceLists() {
  try {
    const priceLists = await db.priceList.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, rules: true },
        },
      },
    });
    return { priceLists };
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return { error: "Failed to fetch price lists" };
  }
}

export async function getAllPriceLists() {
  try {
    const priceLists = await db.priceList.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { priceLists };
  } catch (error) {
    console.error("Error fetching all price lists:", error);
    return { error: "Failed to fetch price lists" };
  }
}

export async function getPriceList(id: string) {
  try {
    const priceList = await db.priceList.findUnique({
      where: { id },
      include: {
        rules: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    content: true,
                    slug: true,
                    sku: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return { priceList };
  } catch (error) {
    console.error("Error fetching price list:", error);
    return { error: "Failed to fetch price list" };
  }
}

export async function createPriceList(data: z.infer<typeof priceListSchema>) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const result = priceListSchema.safeParse(data);

  if (!result.success) {
    return { error: "Invalid data" };
  }

  try {
    const priceList = await db.$transaction(async (tx) => {
      // Ensure only one default price list (inside transaction to prevent race)
      if (result.data.isDefault) {
        await tx.priceList.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return await tx.priceList.create({
        data: result.data,
      });
    });
    revalidatePath("/admin/price-lists");
    return { success: true, priceList };
  } catch (error) {
    console.error("Error creating price list:", error);
    return { error: "Failed to create price list" };
  }
}

export async function updatePriceList(
  id: string,
  data: z.infer<typeof priceListSchema>
) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const result = priceListSchema.safeParse(data);

  if (!result.success) {
    return { error: "Invalid data" };
  }

  try {
    const priceList = await db.$transaction(async (tx) => {
      // Ensure only one default price list (inside transaction to prevent race)
      if (result.data.isDefault) {
        await tx.priceList.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return await tx.priceList.update({
        where: { id },
        data: result.data,
      });
    });
    revalidatePath("/admin/price-lists");
    return { success: true, priceList };
  } catch (error) {
    console.error("Error updating price list:", error);
    return { error: "Failed to update price list" };
  }
}

export async function deletePriceList(id: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.priceList.delete({
      where: { id },
    });
    revalidatePath("/admin/price-lists");
    return { success: true };
  } catch (error) {
    console.error("Error deleting price list:", error);
    return { error: "Failed to delete price list" };
  }
}

export async function createPriceListRule(
  data: z.infer<typeof priceListRuleSchema>
) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const result = priceListRuleSchema.safeParse(data);

  if (!result.success) {
    return { error: "Invalid data" };
  }

  try {
    // Check if rule exists (upsert logic or unique constraint check)
    // The unique constraint is [priceListId, variantId, minQuantity]
    // If it exists, we might want to update the price? Or just fail?
    // Let's use upsert.

    const rule = await db.priceListRule.upsert({
      where: {
        priceListId_variantId_minQuantity: {
          priceListId: result.data.priceListId,
          variantId: result.data.variantId,
          minQuantity: result.data.minQuantity,
        },
      },
      update: {
        price: result.data.price,
      },
      create: {
        priceListId: result.data.priceListId,
        variantId: result.data.variantId,
        minQuantity: result.data.minQuantity,
        price: result.data.price,
      },
    });

    revalidatePath(`/admin/price-lists/${result.data.priceListId}`);
    revalidatePath("/admin/customers");
    return { success: true, rule };
  } catch (error) {
    console.error("Error creating price list rule:", error);
    return { error: "Failed to create price list rule" };
  }
}

export async function getOrCreateCustomerPriceList(userId: string, userName: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        priceLists: {
          include: {
            rules: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: { content: true, slug: true, sku: true },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" as const },
            },
          },
        },
      },
    });

    if (!user) return { error: "User not found" };

    if (user.priceLists.length > 0) {
      return { priceList: user.priceLists[0] };
    }

    // Create a new price list and bind to user
    const priceList = await db.priceList.create({
      data: {
        name: `${userName} - Custom Price List`,
        currency: "EUR",
        users: { connect: { id: userId } },
      },
      include: {
        rules: {
          include: {
            variant: {
              include: {
                product: {
                  select: { content: true, slug: true, sku: true },
                },
              },
            },
          },
        },
      },
    });

    revalidatePath(`/admin/customers/${userId}`);
    return { priceList };
  } catch (error) {
    console.error("Error getting/creating customer price list:", error);
    return { error: "Failed to get or create price list" };
  }
}

export async function batchImportPriceListRules(priceListId: string, formData: FormData) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const text = await file.text();
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // Skip header line if it starts with "sku" or "SKU"
  const startIdx = lines[0]?.toLowerCase().startsWith("sku") ? 1 : 0;

  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map(s => s.trim());
    if (parts.length < 2) {
      results.errors.push(`Line ${i + 1}: insufficient columns`);
      continue;
    }

    const [sku, priceStr, minQtyStr] = parts;
    const price = parseFloat(priceStr);
    const minQuantity = parseInt(minQtyStr || "1") || 1;

    if (isNaN(price) || price < 0) {
      results.errors.push(`Line ${i + 1}: invalid price "${priceStr}"`);
      continue;
    }

    // Find variant by SKU
    const variant = await db.productVariant.findFirst({ where: { sku } });
    if (!variant) {
      results.errors.push(`Line ${i + 1}: SKU "${sku}" not found`);
      continue;
    }

    try {
      await db.priceListRule.upsert({
        where: {
          priceListId_variantId_minQuantity: {
            priceListId,
            variantId: variant.id,
            minQuantity,
          },
        },
        update: { price },
        create: { priceListId, variantId: variant.id, minQuantity, price },
      });
      results.imported++;
    } catch (e) {
      results.errors.push(`Line ${i + 1}: failed to import SKU "${sku}"`);
    }
  }

  revalidatePath(`/admin/price-lists/${priceListId}`);
  return { success: true, ...results };
}

export async function deletePriceListRule(id: string, priceListId: string) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.priceListRule.delete({
      where: { id },
    });
    revalidatePath(`/admin/price-lists/${priceListId}`);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting price list rule:", error);
    return { error: "Failed to delete price list rule" };
  }
}
