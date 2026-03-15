import * as z from "zod";

// --- Constants ---

export const SUPPORTED_LOCALES = [
  "es",
  "zh",
  "en",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
] as const;
export const AI_SUPPORTED_LOCALES = [
  "zh",
  "es",
  "en",
  "de",
  "fr",
  "it",
  "pt",
  "nl",
  "pl",
] as const;
export const AI_FIELDS = [
  "name",
  "description",
  "seoTitle",
  "seoDescription",
] as const;
export type LocalizedField = (typeof AI_FIELDS)[number];

// --- Schema Definition ---

const localizedContentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

// Create a dynamic schema object for locales
const localesSchema = z.object(
  SUPPORTED_LOCALES.reduce(
    (acc, locale) => {
      // Enforce name for 'es' as primary language
      acc[locale] =
        locale === "es"
          ? (localizedContentSchema.extend({
              name: z.string().min(1, "Name (ES) is required"),
            }) as unknown as typeof localizedContentSchema)
          : localizedContentSchema;
      return acc;
    },
    {} as Record<string, typeof localizedContentSchema>
  )
);

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  ean: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  b2bPrice: z.coerce.number().optional(),
  compareAtPrice: z.coerce.number().optional(),
  costPrice: z.coerce.number().optional(),
  physicalStock: z.coerce.number().min(0).default(0),
  allocatedStock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  specs: z.record(z.any()).optional(),
});

export const productFormSchema = z.object({
  // Basic Info
  slug: z.string().min(1, "Slug is required"),
  baseSku: z.string().min(1, "Base SKU is required"),
  type: z.enum(["SIMPLE", "BUNDLE"]).default("SIMPLE"),
  categoryId: z.string().min(1, "Category is required"),
  supplierId: z.string().optional(), // Legacy
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  images: z.array(z.string()).default([]),

  // Locales
  locales: localesSchema,

  // Tech Specs
  brand: z.string().optional(),
  series: z.string().optional(),
  origin: z.string().optional(),

  // Customs / HS Code
  hsCode: z.string().optional(),

  // Dynamic Specs (Unified Configurator)
  // Allows string, number, boolean, or array (DB may store any of these)
  specs: z.record(z.any()).optional(),

  hasVariants: z.boolean().default(false),

  variants: z.array(variantSchema).min(1, "At least one variant is required"),

  // ERP Fields
  bundleItems: z
    .array(
      z.object({
        childId: z.string(),
        quantity: z.coerce.number().min(1),
        sku: z.string().optional(),
        productName: z.string().optional(),
      })
    )
    .optional(),

  productSuppliers: z
    .array(
      z.object({
        supplierId: z.string(),
        supplierSku: z.string().optional(),
        costPrice: z.coerce.number().optional(),
        moq: z.coerce.number().int().optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .optional(),

  documents: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.enum(["CERTIFICATE", "DATASHEET", "MANUAL", "PHOTOMETRIC", "OTHER"]),
        name: z.string().default(""),
        url: z.string().default(""),
        imageUrl: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.coerce.number().int().default(0),
      })
    )
    .optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
