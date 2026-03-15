"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProductPrice } from "@/lib/pricing";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function refreshCartPrices(
  items: { id: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const priceMap: Record<string, number> = {};

  await Promise.all(
    items.map(async ({ id, quantity }) => {
      try {
        const price = await getProductPrice(userId, id, quantity);
        priceMap[id] = price;
      } catch (error) {
        console.error(`Failed to fetch price for variant ${id}:`, error);
      }
    })
  );

  return priceMap;
}

// --- Cart Persistence ---

export async function syncCartWithServer(
  localItems: { id: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return null;

  // Check if user exists in database
  const userExists = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    return null;
  }

  // 1. Get or Create Cart
  let cart = await db.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  if (!cart) {
    cart = await db.cart.create({
      data: { userId },
      include: { items: true },
    });
  }

  const filteredItems = localItems.filter((item) => item.quantity > 0);

  const serverItemsMap = new Map(cart.items.map((i) => [i.variantId, i]));
  const clientItemsMap = new Map(filteredItems.map((i) => [i.id, i]));

  const toAdd: { id: string; quantity: number }[] = [];
  const toUpdate: { id: string; quantity: number }[] = [];
  const toDeleteIds: string[] = [];

  for (const clientItem of filteredItems) {
    const serverItem = serverItemsMap.get(clientItem.id);
    if (serverItem) {
      if (serverItem.quantity !== clientItem.quantity) {
        toUpdate.push(clientItem);
      }
    } else {
      toAdd.push(clientItem);
    }
  }

  for (const serverItem of cart.items) {
    if (!clientItemsMap.has(serverItem.variantId)) {
      toDeleteIds.push(serverItem.id);
    }
  }

  await db.$transaction(async (tx) => {
    if (toDeleteIds.length > 0) {
      await tx.cartItem.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    for (const item of toAdd) {
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: item.id,
          quantity: item.quantity,
        },
      });
    }

    for (const item of toUpdate) {
      const serverItem = serverItemsMap.get(item.id);
      if (serverItem) {
        await tx.cartItem.update({
          where: { id: serverItem.id },
          data: { quantity: item.quantity },
        });
      }
    }
  });

  // 3. Fetch final state with details
  return await getCartItems(userId);
}

async function getCartItems(userId: string) {
  const finalCart = await db.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!finalCart) return [];

  // 4. Map to CartItem structure
  const cartItems = (
    await Promise.all(
      finalCart.items.map(async (item) => {
        try {
          const price = await getProductPrice(
            userId,
            item.variantId,
            item.quantity
          );

          // Extract Image
          let image = undefined;
          const content = item.variant.product.content as any;
          if (
            content?.images &&
            Array.isArray(content.images) &&
            content.images.length > 0
          ) {
            const firstImage = content.images[0];
            image =
              typeof firstImage === "string"
                ? firstImage
                : firstImage?.url || null;
          }

          // Extract Name
          let name = item.variant.product.slug;
          if (content?.es?.name) name = content.es.name;
          else if (content?.en?.name) name = content.en.name;

          return {
            id: item.variantId,
            productId: item.variant.productId,
            name,
            price,
            image,
            quantity: item.quantity,
            maxStock: item.variant.physicalStock - item.variant.allocatedStock,
          };
        } catch (error) {
          console.error(`Failed to map cart item ${item.id}:`, error);
          return null;
        }
      })
    )
  ).filter(Boolean);

  return cartItems;
}

export async function addToServerCart(variantId: string, quantity: number) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  if (quantity <= 0) return;

  // Verify user exists to prevent foreign key constraint errors (zombie sessions)
  const userExists = await db.user.findUnique({ where: { id: userId } });
  if (!userExists) throw new Error("User not found");

  // Verify variant exists and check stock
  const variantExists = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, physicalStock: true, allocatedStock: true, sku: true },
  });
  if (!variantExists) throw new Error("Product variant not found");

  const cart = await db.cart.findUnique({ where: { userId } });

  // Validate stock availability
  const available = variantExists.physicalStock - variantExists.allocatedStock;
  if (cart) {
    // Check if item exists
    const existing = await db.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    const currentQty = existing?.quantity ?? 0;
    const totalQty = currentQty + quantity;
    if (totalQty > available) {
      throw new Error(`Insufficient stock for ${variantExists.sku} (available: ${available}, in cart: ${currentQty})`);
    }

    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await db.cartItem.create({
        data: { cartId: cart.id, variantId, quantity },
      });
    }
  } else {
    if (quantity > available) {
      throw new Error(`Insufficient stock for ${variantExists.sku} (available: ${available})`);
    }
    // Should create cart if missing
    await db.cart.create({
      data: {
        userId,
        items: {
          create: { variantId, quantity },
        },
      },
    });
  }

  revalidatePath("/cart");
}

export async function addBatchToServerCart(
  items: { variantId: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;

  const positiveItems = items.filter((item) => item.quantity > 0);
  if (positiveItems.length === 0) return;

  // Verify user exists
  const userExists = await db.user.findUnique({ where: { id: userId } });
  if (!userExists) return;

  // Filter out invalid variants
  const variants = await db.productVariant.findMany({
    where: { id: { in: positiveItems.map((i) => i.variantId) } },
    select: { id: true },
  });
  const validVariantIds = new Set(variants.map((v) => v.id));
  const validItems = positiveItems.filter((i) => validVariantIds.has(i.variantId));

  if (validItems.length === 0) return;

  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  if (cart) {
    await db.$transaction(async (tx) => {
      for (const item of validItems) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: { cartId: cart.id, variantId: item.variantId },
          },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }
      }
    });
  } else {
    await db.cart.create({
      data: {
        userId,
        items: {
          create: validItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
    });
  }

  revalidatePath("/cart");
  return await getCartItems(userId);
}

export async function updateServerCartItem(
  variantId: string,
  quantity: number
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;

  const cart = await db.cart.findUnique({ where: { userId } });
  if (!cart) return;

  // Use upsert to handle cases where item might be missing
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  });

  if (existing) {
    if (quantity <= 0) {
      await db.cartItem.delete({ where: { id: existing.id } });
    } else {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity },
      });
    }
  } else if (quantity > 0) {
    await db.cartItem.create({
      data: { cartId: cart.id, variantId, quantity },
    });
  }

  revalidatePath("/cart");
}

export async function removeFromServerCart(variantId: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;

  const cart = await db.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await db.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      variantId,
    },
  });

  revalidatePath("/cart");
}

// Full Sync (Overwrite Server with Client State)
// Used when client is the source of truth (e.g. after initial merge)
export async function saveCartToServer(
  items: { id: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;

  // Check if user exists in database
  const userExists = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    return;
  }

  let cart = await db.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  if (!cart) {
    cart = await db.cart.create({
      data: { userId },
      include: { items: true },
    });
  }

  // 1. Identify items to add, update, or remove
  const serverItemsMap = new Map(cart.items.map((i) => [i.variantId, i]));
  const clientItemsMap = new Map(items.map((i) => [i.id, i]));

  const toAdd: { id: string; quantity: number }[] = [];
  const toUpdate: { id: string; quantity: number }[] = [];
  const toDeleteIds: string[] = [];

  // Check Client Items against Server
  for (const clientItem of items) {
    const serverItem = serverItemsMap.get(clientItem.id);
    if (serverItem) {
      if (serverItem.quantity !== clientItem.quantity) {
        toUpdate.push(clientItem);
      }
    } else {
      toAdd.push(clientItem);
    }
  }

  // Check Server Items against Client (for deletion)
  for (const serverItem of cart.items) {
    if (!clientItemsMap.has(serverItem.variantId)) {
      toDeleteIds.push(serverItem.id);
    }
  }

  // 2. Execute Updates
  await db.$transaction(async (tx) => {
    // Delete
    if (toDeleteIds.length > 0) {
      await tx.cartItem.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    // Add
    for (const item of toAdd) {
      await tx.cartItem.create({
        data: {
          cartId: cart!.id, // cart is definitely not null here
          variantId: item.id,
          quantity: item.quantity,
        },
      });
    }

    // Update
    for (const item of toUpdate) {
      // Find the cartItem ID (we know it exists)
      const serverItem = serverItemsMap.get(item.id);
      if (serverItem) {
        await tx.cartItem.update({
          where: { id: serverItem.id },
          data: { quantity: item.quantity },
        });
      }
    }
  });

  revalidatePath("/cart");
}

export async function clearServerCart() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return;

  const cart = await db.cart.findUnique({ where: { userId } });
  if (!cart) return;

  await db.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await tx.cart.deleteMany({ where: { userId } });
  });

  revalidatePath("/cart");
}
