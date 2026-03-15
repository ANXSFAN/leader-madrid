"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { syncProductToIndex, deleteProductFromIndex } from "@/lib/search/sync";
import { requireRole } from "@/lib/auth-guard";
import { createAuditLog, diffObjects } from "@/lib/audit";
import { cleanupStorageUrls } from "@/lib/utils/storage-cleanup-server";

// --- Interfaces ---

export interface ProductLocales {
  [key: string]: {
    name: string;
    description?: string;
  };
}

export interface ProductSpecs {
  [key: string]: string | number | boolean | string[];
}

// --- Schemas ---

const specsValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1),
  ean: z.string().optional().nullable(),
  price: z.number().min(0),
  b2bPrice: z.number().optional().nullable(),
  compareAtPrice: z.number().optional().nullable(),
  costPrice: z.number().optional().nullable(),
  physicalStock: z.number().int().min(0),
  allocatedStock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0),
  specs: z.record(specsValueSchema).optional(),
});

const bundleItemSchema = z.object({
  childId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const productSupplierSchema = z.object({
  supplierId: z.string().min(1),
  supplierSku: z.string().optional(),
  costPrice: z.number().optional().nullable(),
  moq: z.number().int().min(1).optional(),
  isPrimary: z.boolean().optional(),
});

const productDocumentSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["CERTIFICATE", "DATASHEET", "MANUAL", "PHOTOMETRIC", "OTHER"]),
  name: z.string().default(""),
  url: z.string().default(""),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

const productSchema = z.object({
  slug: z.string().min(1),
  baseSku: z.string().min(1),
  brand: z.string().optional().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean().default(false),
  type: z.enum(["SIMPLE", "BUNDLE"]).default("SIMPLE"),
  categoryId: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  locales: z.record(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  ),
  specs: z.record(specsValueSchema).optional().nullable(),
  series: z.string().optional().nullable(),
  origin: z.string().optional().nullable(),
  hsCode: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  variants: z.array(variantSchema).default([]),
  bundleItems: z.array(bundleItemSchema).optional(),
  productSuppliers: z.array(productSupplierSchema).optional(),
  documents: z.array(productDocumentSchema).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export async function createProduct(data: unknown) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  if (!data || typeof data !== "object") {
    return { error: "Datos de producto inválidos" };
  }

  // Cast to specific type for initial processing
  const input = data as Record<string, unknown>;

  const normalizedData = {
    ...input,
    locales: input.locales ?? {},
    specs: input.specs ?? {},
    images: Array.isArray(input.images) ? input.images : [],
    variants: Array.isArray(input.variants) ? input.variants : [],
    bundleItems: Array.isArray(input.bundleItems)
      ? input.bundleItems
      : undefined,
    productSuppliers: Array.isArray(input.productSuppliers)
      ? input.productSuppliers
      : undefined,
    documents: Array.isArray(input.documents)
      ? input.documents
      : undefined,
  };

  const result = productSchema.safeParse(normalizedData);

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Datos de producto inválidos" };
  }

  const validData = result.data;

  // 1. Uniqueness Check (Slug & SKU)
  const existingProduct = await db.product.findFirst({
    where: {
      OR: [{ slug: validData.slug }, { sku: validData.baseSku }],
    },
  });

  if (existingProduct) {
    return { error: "SKU o Slug ya existe" };
  }

  // Ensure at least one variant exists
  if (validData.variants.length === 0) {
    validData.variants.push({
      sku: validData.baseSku,
      price: 0,
      physicalStock: 0,
      allocatedStock: 0,
      minStock: 0,
      specs: {},
      ean: null,
      compareAtPrice: null,
      costPrice: null,
    });
  }

  try {
    let createdProductId: string | null = null;

    await db.$transaction(async (tx) => {
      // 0. Ensure Supplier
      let finalSupplierId = validData.supplierId;
      // Handle empty string or null
      if (!finalSupplierId || finalSupplierId.trim() === "") {
        const defaultSupplier = await tx.supplier.findFirst({
          orderBy: { createdAt: "asc" },
        });
        if (defaultSupplier) {
          finalSupplierId = defaultSupplier.id;
        } else {
          finalSupplierId = null; // Explicitly set to null if no default found
        }
      }

      // 1. Construct Content JSON
      // Explicitly cast to ProductSpecs to satisfy TS if needed, though Schema ensures structure
      const specsObject: ProductSpecs = (validData.specs || {}) as ProductSpecs;

      if (validData.series) specsObject.series = validData.series;
      if (validData.origin) specsObject.origin = validData.origin;

      const contentJson = {
        ...validData.locales,
        specs: specsObject,
        images: validData.images || [],
      };

      // 2. Create Product
      const product = await tx.product.create({
        data: {
          slug: validData.slug,
          sku: validData.baseSku,
          type: validData.type,
          brand: validData.brand,
          hsCode: validData.hsCode || null,
          isActive: validData.isActive,
          isFeatured: validData.isFeatured,
          categoryId: validData.categoryId,
          supplierId: finalSupplierId,
          content: contentJson,
        },
      });
      createdProductId = product.id;

      // 3. Create Variants (Loop to handle initial stock movement)
      if (validData.variants.length > 0) {
        for (const variant of validData.variants) {
          // Auto-clear invalid compareAtPrice (scheme A)
          if (
            variant.compareAtPrice !== null &&
            variant.compareAtPrice !== undefined &&
            variant.compareAtPrice <= variant.price
          ) {
            variant.compareAtPrice = null;
          }

          await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: variant.sku,
              ean: variant.ean,
              price: variant.price,
              b2bPrice: variant.b2bPrice,
              compareAtPrice: variant.compareAtPrice,
              costPrice: variant.costPrice,
              physicalStock: 0,
              allocatedStock: 0,
              minStock: variant.minStock,
              specs: (variant.specs || {}) as Prisma.InputJsonValue,
              content: {},
            },
          });
        }
      }

      // 4. Create Bundle Items (if type is BUNDLE)
      if (validData.type === "BUNDLE" && validData.bundleItems?.length) {
        await tx.bundleItem.createMany({
          data: validData.bundleItems.map((item) => ({
            parentId: product.id,
            childId: item.childId,
            quantity: item.quantity,
          })),
        });
      }

      // 5. Create Product Suppliers
      if (validData.productSuppliers?.length) {
        await tx.productSupplier.createMany({
          data: validData.productSuppliers.map((supplier) => ({
            productId: product.id,
            supplierId: supplier.supplierId,
            supplierSku: supplier.supplierSku,
            costPrice: supplier.costPrice,
            moq: supplier.moq || 1,
            isPrimary: supplier.isPrimary || false,
          })),
        });
      }

      // 6. Create Product Documents
      if (validData.documents?.length) {
        await tx.productDocument.createMany({
          data: validData.documents.map((doc, index) => ({
            productId: product.id,
            type: doc.type,
            name: doc.name,
            url: doc.url,
            imageUrl: doc.imageUrl || null,
            description: doc.description || null,
            sortOrder: doc.sortOrder ?? index,
          })),
        });
      }
    });

    revalidatePath("/admin/products");
    if (createdProductId) {
      syncProductToIndex(createdProductId).catch(() => {});
      createAuditLog({
        entityType: "PRODUCT",
        entityId: createdProductId,
        action: "CREATE",
        changes: { slug: { old: null, new: validData.slug }, sku: { old: null, new: validData.baseSku } },
        userId: session.user?.id,
        userName: session.user?.name || session.user?.email,
      }).catch(console.error);
    }
    return { success: true };
  } catch (error: unknown) {
    console.error("Error creating product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create product";
    return { error: errorMessage };
  }
}

export async function updateProduct(id: string, data: unknown) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  if (!data || typeof data !== "object") {
    return { error: "Datos de producto inválidos" };
  }

  const input = data as Record<string, unknown>;

  const normalizedData = {
    ...input,
    locales: input.locales ?? {},
    specs: input.specs ?? {},
    images: Array.isArray(input.images) ? input.images : [],
    variants: Array.isArray(input.variants) ? input.variants : [],
    bundleItems: Array.isArray(input.bundleItems)
      ? input.bundleItems
      : undefined,
    productSuppliers: Array.isArray(input.productSuppliers)
      ? input.productSuppliers
      : undefined,
    documents: Array.isArray(input.documents)
      ? input.documents
      : undefined,
  };

  const result = productSchema.safeParse(normalizedData);

  if (!result.success) {
    console.error("Validation error:", result.error);
    return { error: "Datos de producto inválidos" };
  }

  const validData = result.data;

  // 1. Uniqueness Check (Slug & SKU)
  const conflictingProduct = await db.product.findFirst({
    where: {
      AND: [
        { id: { not: id } },
        {
          OR: [{ slug: validData.slug }, { sku: validData.baseSku }],
        },
      ],
    },
  });

  if (conflictingProduct) {
    return { error: "SKU o Slug ya existe" };
  }

  // Fetch original product for audit diff
  const originalProduct = await db.product.findUnique({
    where: { id },
    select: { slug: true, sku: true, isActive: true, isFeatured: true, brand: true, categoryId: true, content: true },
  });

  try {
    await db.$transaction(async (tx) => {
      const specsObject: ProductSpecs = (validData.specs || {}) as ProductSpecs;

      if (validData.series) specsObject.series = validData.series;
      if (validData.origin) specsObject.origin = validData.origin;

      const contentJson = {
        ...validData.locales,
        specs: specsObject,
        images: validData.images || [],
      };

      // 0. Ensure Supplier
      let finalSupplierId = validData.supplierId;
      if (!finalSupplierId) {
        // Keep existing if not provided, or fetch default?
        // Usually update just updates what's provided. But here we have full form data.
        // If supplierId is null, maybe we should clear it? Or keep it?
        // Schema says optional nullable.
      }

      // 2. Update Product
      // Sanitize supplierId to avoid FK errors with empty strings
      const supplierIdToUpdate =
        validData.supplierId === "" ? null : validData.supplierId;

      await tx.product.update({
        where: { id },
        data: {
          slug: validData.slug,
          sku: validData.baseSku,
          brand: validData.brand,
          hsCode: validData.hsCode || null,
          isActive: validData.isActive,
          isFeatured: validData.isFeatured,
          type: validData.type,
          categoryId: validData.categoryId,
          supplierId: supplierIdToUpdate,
          content: contentJson,
        },
      });

      // 2. Handle Variants (Optimized & Concurrent)
      const existingVariants = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const existingIds = new Set(existingVariants.map((v) => v.id));

      const variantsToUpdate = validData.variants.filter(
        (v) => v.id && existingIds.has(v.id)
      );
      const variantsToCreate = validData.variants.filter((v) => !v.id);

      const incomingIds = new Set(variantsToUpdate.map((v) => v.id as string));
      const variantsToDelete = [...existingIds].filter(
        (id) => !incomingIds.has(id)
      );

      // 2.1 Delete removed variants (with foreign key handling)
      if (variantsToDelete.length > 0) {
        try {
          await tx.productVariant.deleteMany({
            where: { id: { in: variantsToDelete } },
          });
        } catch (e: unknown) {
          // Check for foreign key constraint violation (Prisma error code P2003)
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2003"
          ) {
            throw new Error(
              `No se pueden eliminar algunas variantes porque están en uso (pedidos, etc.). Márquelas como sin stock o inactivas.`
            );
          }
          console.warn("Could not delete variants:", variantsToDelete, e);

          throw new Error(
            "No se pueden eliminar variantes que tienen historial de datos asociado."
          );
        }
      }

      // 2.2 Concurrent Updates
      await Promise.all(
        variantsToUpdate.map(async (variant) => {
          if (!variant.id) return;

          // Auto-clear invalid compareAtPrice (scheme A)
          if (
            variant.compareAtPrice !== null &&
            variant.compareAtPrice !== undefined &&
            variant.compareAtPrice <= variant.price
          ) {
            variant.compareAtPrice = null;
          }

          // Stock is NOT updated via the product form.
          // Stock changes should only happen through purchase orders / stock-in orders.
          // The form UI makes physicalStock read-only when editing, and we skip
          // any stock diff processing here to enforce this at the server level.

          return tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              ean: variant.ean,
              price: variant.price,
              b2bPrice: variant.b2bPrice,
              compareAtPrice: variant.compareAtPrice,
              costPrice: variant.costPrice,
              minStock: variant.minStock,
              specs: (variant.specs || {}) as Prisma.InputJsonValue,
              // physicalStock is intentionally omitted — managed via purchase orders only
            },
          });
        })
      );

      // 2.3 Batch Create (Loop to handle initial stock movement)
      if (variantsToCreate.length > 0) {
        for (const variant of variantsToCreate) {
          // Auto-clear invalid compareAtPrice (scheme A)
          if (
            variant.compareAtPrice !== null &&
            variant.compareAtPrice !== undefined &&
            variant.compareAtPrice <= variant.price
          ) {
            variant.compareAtPrice = null;
          }

          const created = await tx.productVariant.create({
            data: {
              productId: id,
              sku: variant.sku,
              ean: variant.ean,
              price: variant.price,
              b2bPrice: variant.b2bPrice,
              compareAtPrice: variant.compareAtPrice,
              costPrice: variant.costPrice,
              physicalStock: 0, // Initialize with 0, then adjust
              allocatedStock: 0,
              minStock: variant.minStock,
              specs: (variant.specs || {}) as Prisma.InputJsonValue,
              content: {},
            },
          });

          // Stock is managed through inventory adjustments, not set at creation
        }
      }

      // 3. Smart Update: Bundle Items (Diff Logic)
      if (validData.type === "BUNDLE") {
        const incomingItems = validData.bundleItems || [];
        const existingBundleItems = await tx.bundleItem.findMany({
          where: { parentId: id },
        });

        // Map existing items by childId for easy lookup
        const existingMap = new Map(
          existingBundleItems.map((item) => [item.childId, item])
        );
        const incomingMap = new Map(
          incomingItems.map((item) => [item.childId, item])
        );

        const toDeleteIds: string[] = [];
        const toCreateItems: Prisma.BundleItemCreateManyInput[] = [];
        const toUpdatePromises: Promise<unknown>[] = [];

        // Identify items to delete (in existing but not in incoming)
        for (const [childId, item] of existingMap) {
          if (!incomingMap.has(childId)) {
            toDeleteIds.push(item.id);
          }
        }

        // Identify items to create or update
        for (const item of incomingItems) {
          const existingItem = existingMap.get(item.childId);
          if (existingItem) {
            // Update if quantity changed
            if (existingItem.quantity !== item.quantity) {
              toUpdatePromises.push(
                tx.bundleItem.update({
                  where: { id: existingItem.id },
                  data: { quantity: item.quantity },
                })
              );
            }
          } else {
            // Create new
            toCreateItems.push({
              parentId: id,
              childId: item.childId,
              quantity: item.quantity,
            });
          }
        }

        // Execute DB operations
        if (toDeleteIds.length > 0) {
          await tx.bundleItem.deleteMany({
            where: { id: { in: toDeleteIds } },
          });
        }
        if (toCreateItems.length > 0) {
          await tx.bundleItem.createMany({ data: toCreateItems });
        }
        if (toUpdatePromises.length > 0) {
          await Promise.all(toUpdatePromises);
        }
      } else {
        // If switched from BUNDLE to SIMPLE, clear bundle items
        await tx.bundleItem.deleteMany({ where: { parentId: id } });
      }

      // 4. Smart Update: Product Suppliers (Diff Logic)
      const incomingSuppliers = validData.productSuppliers || [];
      const existingProductSuppliers = await tx.productSupplier.findMany({
        where: { productId: id },
      });

      const existingSuppliersMap = new Map(
        existingProductSuppliers.map((ps) => [ps.supplierId, ps])
      );
      const incomingSuppliersMap = new Map(
        incomingSuppliers.map((ps) => [ps.supplierId, ps])
      );

      const psToDeleteIds: string[] = [];
      const psToCreateItems: Prisma.ProductSupplierCreateManyInput[] = [];
      const psToUpdatePromises: Promise<unknown>[] = [];

      // Identify to Delete
      for (const [supplierId, ps] of existingSuppliersMap) {
        if (!incomingSuppliersMap.has(supplierId)) {
          psToDeleteIds.push(ps.id);
        }
      }

      // Identify to Create or Update
      for (const ps of incomingSuppliers) {
        const existingPs = existingSuppliersMap.get(ps.supplierId);
        if (existingPs) {
          // Check if any field changed
          // Safe handling of Decimal vs Number and Null vs Undefined
          const existingCost = existingPs.costPrice
            ? Number(existingPs.costPrice)
            : null;
          const incomingCost = ps.costPrice ?? null;

          const hasChanged =
            existingPs.supplierSku !== (ps.supplierSku ?? null) ||
            existingCost !== incomingCost ||
            existingPs.moq !== (ps.moq || 1) ||
            existingPs.isPrimary !== (ps.isPrimary || false);

          if (hasChanged) {
            psToUpdatePromises.push(
              tx.productSupplier.update({
                where: { id: existingPs.id },
                data: {
                  supplierSku: ps.supplierSku,
                  costPrice: ps.costPrice,
                  moq: ps.moq || 1,
                  isPrimary: ps.isPrimary || false,
                },
              })
            );
          }
        } else {
          psToCreateItems.push({
            productId: id,
            supplierId: ps.supplierId,
            supplierSku: ps.supplierSku,
            costPrice: ps.costPrice,
            moq: ps.moq || 1,
            isPrimary: ps.isPrimary || false,
          });
        }
      }

      if (psToDeleteIds.length > 0) {
        await tx.productSupplier.deleteMany({
          where: { id: { in: psToDeleteIds } },
        });
      }
      if (psToCreateItems.length > 0) {
        await tx.productSupplier.createMany({ data: psToCreateItems });
      }
      if (psToUpdatePromises.length > 0) {
        await Promise.all(psToUpdatePromises);
      }

      // 5. Smart Update: Product Documents (Diff Logic)
      const incomingDocs = validData.documents || [];
      const existingDocs = await tx.productDocument.findMany({
        where: { productId: id },
      });

      const existingDocsMap = new Map(existingDocs.map((d) => [d.id, d]));
      const incomingDocIds = new Set(
        incomingDocs.filter((d) => d.id).map((d) => d.id as string)
      );

      // Delete docs not in incoming
      const docsToDeleteIds = existingDocs
        .filter((d) => !incomingDocIds.has(d.id))
        .map((d) => d.id);
      if (docsToDeleteIds.length > 0) {
        await tx.productDocument.deleteMany({
          where: { id: { in: docsToDeleteIds } },
        });
      }

      // Create or update docs
      for (let i = 0; i < incomingDocs.length; i++) {
        const doc = incomingDocs[i];
        if (doc.id && existingDocsMap.has(doc.id)) {
          // Update existing
          await tx.productDocument.update({
            where: { id: doc.id },
            data: {
              type: doc.type,
              name: doc.name,
              url: doc.url,
              imageUrl: doc.imageUrl || null,
              description: doc.description || null,
              sortOrder: doc.sortOrder ?? i,
            },
          });
        } else {
          // Create new
          await tx.productDocument.create({
            data: {
              productId: id,
              type: doc.type,
              name: doc.name,
              url: doc.url,
              imageUrl: doc.imageUrl || null,
              description: doc.description || null,
              sortOrder: doc.sortOrder ?? i,
            },
          });
        }
      }
    });

    // Clean up removed images from storage
    const oldImages: string[] = (originalProduct?.content as Record<string, unknown>)?.images as string[] || [];
    const newImages: string[] = validData.images || [];
    const removedImages = oldImages.filter((url) => !newImages.includes(url));
    if (removedImages.length > 0) {
      cleanupStorageUrls(removedImages).catch(console.error);
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    syncProductToIndex(id).catch(() => {});
    createAuditLog({
      entityType: "PRODUCT",
      entityId: id,
      action: "UPDATE",
      changes: originalProduct
        ? diffObjects(
            { slug: originalProduct.slug, sku: originalProduct.sku, isActive: originalProduct.isActive, isFeatured: originalProduct.isFeatured, brand: originalProduct.brand, categoryId: originalProduct.categoryId },
            { slug: validData.slug, sku: validData.baseSku, isActive: validData.isActive, isFeatured: validData.isFeatured, brand: validData.brand, categoryId: validData.categoryId },
            ["slug", "sku", "isActive", "isFeatured", "brand", "categoryId"]
          )
        : null,
      userId: session.user?.id,
      userName: session.user?.name || session.user?.email,
    }).catch(console.error);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update product";
    return { error: errorMessage };
  }
}

export async function toggleProductStatus(id: string, isActive: boolean) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.product.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/admin/products");
    syncProductToIndex(id).catch(() => {});
    createAuditLog({
      entityType: "PRODUCT",
      entityId: id,
      action: "STATUS_CHANGE",
      changes: { isActive: { old: !isActive, new: isActive } },
      userId: session.user?.id,
      userName: session.user?.name || session.user?.email,
    }).catch(console.error);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error toggling product status:", error);
    return { error: "Failed to toggle status" };
  }
}

export async function toggleProductFeatured(id: string, isFeatured: boolean) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.product.update({
      where: { id },
      data: { isFeatured },
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    createAuditLog({
      entityType: "PRODUCT",
      entityId: id,
      action: "STATUS_CHANGE",
      changes: { isFeatured: { old: !isFeatured, new: isFeatured } },
      userId: session.user?.id,
      userName: session.user?.name || session.user?.email,
    }).catch(console.error);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error toggling product featured:", error);
    return { error: "Failed to toggle featured" };
  }
}

export async function bulkToggleProductStatus(ids: string[], isActive: boolean) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };
  if (ids.length === 0) return { error: "No products selected" };

  try {
    await db.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    revalidatePath("/admin/products");
    ids.forEach((id) => syncProductToIndex(id).catch(() => {}));
    return { success: true, count: ids.length };
  } catch (error: unknown) {
    console.error("Error bulk toggling product status:", error);
    return { error: "Failed to update products" };
  }
}

export async function bulkDeleteProducts(ids: string[]) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };
  if (ids.length === 0) return { error: "No products selected" };

  const errors: string[] = [];
  let deletedCount = 0;

  for (const id of ids) {
    const result = await deleteProduct(id);
    if ("error" in result && result.error) {
      errors.push(result.error);
    } else {
      deletedCount++;
    }
  }

  revalidatePath("/admin/products");

  if (errors.length > 0 && deletedCount === 0) {
    return { error: errors[0] };
  }

  return { success: true, count: deletedCount, errors };
}

export async function getDiscountedProducts(limit: number = 20) {
  try {
    const products = await db.product.findMany({
      where: {
        isActive: true,
        variants: {
          some: {
            compareAtPrice: {
              not: null,
            },
          },
        },
      },
      include: {
        variants: true,
        // Include minimal fields needed for card display
        // content is JSON, images are inside content usually or separate?
        // In this schema, images are inside content JSON.
        // And 'images' field on Product model might be used too.
      },
      take: limit,
    });
    return { products };
  } catch (error) {
    console.error("Error fetching discounted products:", error);
    return { products: [], error: "Failed to fetch discounted products" };
  }
}

export async function deleteProduct(id: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return { error: "Unauthorized" };

  try {
    // Collect image URLs before deletion for storage cleanup
    const productForCleanup = await db.product.findUnique({
      where: { id },
      select: { content: true },
    });
    const imageUrls: string[] = (productForCleanup?.content as Record<string, unknown>)?.images as string[] || [];

    // All checks and deletions inside a single transaction to prevent TOCTOU races
    await db.$transaction(async (tx) => {
      // 1. Get all variant IDs for this product
      const variants = await tx.productVariant.findMany({
        where: { productId: id },
        select: { id: true },
      });
      const variantIds = variants.map((v) => v.id);

      // 2. Check if any variants are referenced in orders (cannot delete)
      if (variantIds.length > 0) {
        const [orderItems, poItems, soItems, returnItems] = await Promise.all([
          tx.orderItem.count({ where: { variantId: { in: variantIds } } }),
          tx.purchaseOrderItem.count({ where: { variantId: { in: variantIds } } }),
          tx.salesOrderItem.count({ where: { variantId: { in: variantIds } } }),
          tx.returnItem.count({ where: { variantId: { in: variantIds } } }),
        ]);

        if (orderItems + poItems + soItems + returnItems > 0) {
          throw new Error(
            "Cannot delete this product because it has associated order records. You can deactivate it instead."
          );
        }
      }

      // 3. Delete in correct order
      if (variantIds.length > 0) {
        // Delete children that reference ProductVariant
        await tx.warehouseStock.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.inventoryTransaction.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
        await tx.priceListRule.deleteMany({ where: { variantId: { in: variantIds } } });
        // Delete bundle items where this product's variants are children
        await tx.bundleItem.deleteMany({ where: { childId: { in: variantIds } } });
        // Delete variants
        await tx.productVariant.deleteMany({ where: { productId: id } });
      }
      // Delete children that reference Product directly
      await tx.bundleItem.deleteMany({ where: { parentId: id } });
      await tx.productSupplier.deleteMany({ where: { productId: id } });
      await tx.productDocument.deleteMany({ where: { productId: id } });
      await tx.wishlistItem.deleteMany({ where: { productId: id } });
      // Delete the product
      await tx.product.delete({ where: { id } });
    });

    // 4. Remove from search index
    await deleteProductFromIndex(id).catch(() => {});

    // 5. Clean up images from Supabase storage
    if (imageUrls.length > 0) {
      cleanupStorageUrls(imageUrls).catch(console.error);
    }

    revalidatePath("/admin/products");
    createAuditLog({
      entityType: "PRODUCT",
      entityId: id,
      action: "DELETE",
      userId: session.user?.id,
      userName: session.user?.name || session.user?.email,
    }).catch(console.error);
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting product:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete product" };
  }
}

export async function updateProductSortOrder(orderedIds: string[], startIndex: number = 0) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    const ids = orderedIds;
    const orders = orderedIds.map((_, i) => startIndex + i);
    await db.$executeRaw`
      UPDATE products SET "sortOrder" = data.new_order
      FROM unnest(${ids}, ${orders}::int[]) AS data(id, new_order)
      WHERE products.id::text = data.id
    `;
    revalidatePath("/admin/products");
    orderedIds.forEach((id) => syncProductToIndex(id).catch(() => {}));
    return { success: true };
  } catch (error: unknown) {
    console.error("Error updating product sort order:", error);
    return { error: "Failed to update sort order" };
  }
}

export async function toggleProductPinned(id: string, pinned: boolean) {
  const session = await requireRole(["ADMIN"]);
  if (!session) return { error: "Unauthorized" };

  try {
    await db.product.update({
      where: { id },
      data: { isPinned: pinned },
    });
    revalidatePath("/admin/products");
    syncProductToIndex(id).catch(() => {});
    return { success: true };
  } catch (error: unknown) {
    console.error("Error toggling product pinned:", error);
    return { error: "Failed to toggle pinned status" };
  }
}

export async function searchVariantsForBundle(query: string) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) return [];

  const variants = await db.productVariant.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { product: { slug: { contains: query, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      sku: true,
      price: true,
      product: { select: { slug: true, content: true } },
    },
    take: 20,
  });

  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    productName: v.product.slug,
    price: Number(v.price),
  }));
}

// --- Quick Create Product (minimal fields for PO form) ---

const quickCreateProductSchema = z.object({
  nameEs: z.string().min(1, "Spanish name is required"),
  nameEn: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
});

export async function quickCreateProduct(data: z.infer<typeof quickCreateProductSchema>) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) return { error: "Unauthorized" };

  const parsed = quickCreateProductSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid data" };
  }

  const { nameEs, nameEn, sku } = parsed.data;

  // Generate slug from SKU
  const slug = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Check uniqueness
  const existing = await db.product.findFirst({
    where: { OR: [{ slug }, { sku }] },
  });
  if (existing) {
    return { error: "A product with this SKU or slug already exists" };
  }

  try {
    // Find default category or first category
    const category = await db.category.findFirst({ orderBy: { slug: "asc" } });

    const product = await db.product.create({
      data: {
        slug,
        sku,
        type: "SIMPLE",
        isActive: true,
        categoryId: category?.id || null,
        content: {
          es: { name: nameEs, description: "" },
          ...(nameEn ? { en: { name: nameEn, description: "" } } : {}),
          specs: {},
          images: [],
        },
        variants: {
          create: {
            sku,
            price: 0,
            physicalStock: 0,
            allocatedStock: 0,
            minStock: 0,
            specs: {},
            content: {},
          },
        },
      },
      include: {
        variants: { select: { id: true, sku: true } },
      },
    });

    revalidatePath("/admin/products");
    syncProductToIndex(product.id).catch(() => {});

    return {
      success: true,
      product: {
        id: product.id,
        variantId: product.variants[0]?.id,
        sku: product.variants[0]?.sku || sku,
        name: nameEs,
      },
    };
  } catch (error: unknown) {
    console.error("Error quick creating product:", error);
    return { error: error instanceof Error ? error.message : "Failed to create product" };
  }
}
