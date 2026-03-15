import { Client } from "typesense";
import type { SearchResponseHit, SearchResponseFacetCountSchema, SearchResponse } from "typesense/lib/Typesense/Documents";
import type { CollectionSchema, CollectionFieldSchema } from "typesense/lib/Typesense/Collection";

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || "localhost";
const TYPESENSE_PORT = parseInt(process.env.TYPESENSE_PORT || "8108");
const TYPESENSE_PROTOCOL =
  (process.env.TYPESENSE_PROTOCOL as "http" | "https") || "http";
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || "";

export const IS_TYPESENSE_ENABLED = !!process.env.TYPESENSE_API_KEY;

let _client: Client | null = null;
let _ensurePromise: Promise<void> | null = null;

export function getTypesenseClient(): Client {
  if (!_client) {
    _client = new Client({
      nodes: [
        {
          host: TYPESENSE_HOST,
          port: TYPESENSE_PORT,
          protocol: TYPESENSE_PROTOCOL,
        },
      ],
      apiKey: TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 2,
    });
  }
  return _client;
}

export const PRODUCTS_COLLECTION = "products";

export const productsSchema = {
  name: PRODUCTS_COLLECTION,
  fields: [
    { name: "id", type: "string" as const },
    { name: "name_es", type: "string" as const },
    { name: "name_en", type: "string" as const, optional: true },
    {
      name: "description_es",
      type: "string" as const,
      optional: true,
      index: false,
    },
    { name: "slug", type: "string" as const },
    { name: "sku_list", type: "string[]" as const },
    { name: "brand", type: "string" as const, optional: true, facet: true },
    {
      name: "categorySlug",
      type: "string" as const,
      optional: true,
      facet: true,
    },
    { name: "category_path", type: "string[]" as const, facet: true },
    { name: "categoryName", type: "string" as const, optional: true },
    { name: "minPrice", type: "float" as const, facet: true },
    { name: "maxPrice", type: "float" as const, optional: true },
    { name: "prices", type: "float[]" as const, facet: true },
    { name: "isActive", type: "bool" as const, facet: true },
    { name: "totalStock", type: "int32" as const },
    {
      name: "compareAtPrice",
      type: "float" as const,
      optional: true,
      facet: true,
    },
    { name: "createdAt", type: "int64" as const, facet: true },
    { name: "imageUrl", type: "string" as const, optional: true, index: false },
    { name: "images", type: "string[]" as const, optional: true, index: false },
    {
      name: "variants_json",
      type: "string" as const,
      optional: true,
      index: false,
    },
    { name: "tags", type: "string[]" as const, optional: true, facet: true },
    // Dynamic Attributes
    { name: "wattage", type: "int32[]" as const, optional: true, facet: true },
    {
      name: "color_temp",
      type: "string[]" as const,
      optional: true,
      facet: true,
    },
    {
      name: "ip_rating",
      type: "string[]" as const,
      optional: true,
      facet: true,
    },
    { name: "lumens", type: "int32[]" as const, optional: true, facet: true },
    { name: "cri", type: "int32[]" as const, optional: true, facet: true },
    {
      name: "specs_kv",
      type: "string[]" as const,
      optional: true,
      facet: true,
    },
    { name: "sortOrder", type: "int32" as const, optional: true },
  ],
  default_sorting_field: "minPrice",
} as const;

export interface ProductDocument {
  id: string;
  name_es: string;
  name_en?: string;
  description_es?: string;
  slug: string;
  sku_list: string[];
  brand?: string;
  categorySlug?: string;
  category_path: string[];
  categoryName?: string;
  minPrice: number;
  maxPrice?: number;
  prices?: number[];
  compareAtPrice?: number;
  createdAt: number;
  isActive: boolean;
  totalStock: number;
  imageUrl?: string;
  images?: string[];
  variants_json?: string;
  tags?: string[];
  wattage?: number[];
  color_temp?: string[];
  ip_rating?: string[];
  lumens?: number[];
  cri?: number[];
  specs_kv?: string[];
  sortOrder?: number;
}

export async function ensureCollection(): Promise<void> {
  const client = getTypesenseClient();
  try {
    const collection = await client.collections(PRODUCTS_COLLECTION).retrieve();
    const existingFields = new Set(
      (collection as CollectionSchema).fields?.map((f: CollectionFieldSchema) => f.name) ?? []
    );
    const fieldsToCheck = ["specs_kv", "sortOrder"];
    for (const fieldName of fieldsToCheck) {
      if (!existingFields.has(fieldName)) {
        const field = (productsSchema.fields as readonly CollectionFieldSchema[]).find(
          (f: CollectionFieldSchema) => f.name === fieldName
        );
        if (field) {
          await (client.collections(PRODUCTS_COLLECTION) as unknown as { fields(): { create(field: CollectionFieldSchema): Promise<CollectionFieldSchema> } })
            .fields()
            .create(field);
        }
      }
    }
  } catch {
    await client.collections().create(productsSchema as unknown as CollectionSchema);
  }
}

export async function ensureCollectionOnce(): Promise<void> {
  if (!_ensurePromise) {
    _ensurePromise = ensureCollection();
  }
  return _ensurePromise;
}

export async function indexProduct(doc: ProductDocument): Promise<void> {
  const client = getTypesenseClient();
  await ensureCollection();
  await client.collections(PRODUCTS_COLLECTION).documents().upsert(doc);
}

export async function deleteProductFromIndex(id: string): Promise<void> {
  const client = getTypesenseClient();
  try {
    await client.collections(PRODUCTS_COLLECTION).documents(id).delete();
  } catch {}
}

export async function searchProducts(
  query: string,
  opts?: {
    categorySlug?: string;
    page?: number;
    perPage?: number;
    facetBy?: string;
    filterBy?: string;
    sortBy?: string;
    includeInactive?: boolean;
  }
): Promise<{
  hits: Array<{
    id: string;
    slug: string;
    name: string;
    imageUrl?: string;
    images?: string[];
    minPrice: number;
    maxPrice?: number;
    compareAtPrice?: number;
    variants_json?: string;
    categoryName?: string;
    categorySlug?: string;
    name_en?: string;
    sku_list?: string[];
    brand?: string;
    createdAt?: number;
  }>;
  total: number;
  facets: Record<
    string,
    { label: string; options: { value: string; count: number }[] }
  >;
}> {
  const client = getTypesenseClient();
  const filterParts: string[] = [];
  if (!opts?.includeInactive) {
    filterParts.push("isActive:true");
  }
  if (opts?.categorySlug) {
    filterParts.push(`category_path:=${opts.categorySlug}`);
  }

  const searchParams: Record<string, unknown> = {
    q: query || "*",
    query_by: "name_es,name_en,sku_list,brand",
    sort_by: opts?.sortBy || "_text_match:desc,minPrice:asc",
    per_page: opts?.perPage ?? 20,
    page: opts?.page ?? 1,
    typo_tokens_threshold: 1,
    num_typos: 2,
  };

  if (opts?.filterBy) {
    searchParams.filter_by = opts.filterBy;
    if (opts?.categorySlug && !opts.filterBy.includes("category_path:=")) {
      searchParams.filter_by += ` && category_path:=${opts.categorySlug}`;
    }
  } else if (filterParts.length > 0) {
    searchParams.filter_by = filterParts.join(" && ");
  }

  // Add faceting
  if (opts?.facetBy) {
    searchParams.facet_by = opts.facetBy;
    searchParams.max_facet_values = 100;
  }

  const result = await client
    .collections(PRODUCTS_COLLECTION)
    .documents()
    .search(searchParams);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Typesense generic typing workaround
  const hits = ((result.hits ?? []) as any[]).map((h: SearchResponseHit<ProductDocument>) => ({
    id: h.document.id,
    slug: h.document.slug,
    name: h.document.name_es,
    name_en: h.document.name_en,
    imageUrl: h.document.imageUrl,
    images: h.document.images,
    minPrice: h.document.minPrice,
    maxPrice: h.document.maxPrice,
    compareAtPrice: h.document.compareAtPrice,
    variants_json: h.document.variants_json,
    categoryName: h.document.categoryName,
    categorySlug: h.document.categorySlug,
    sku_list: h.document.sku_list,
    brand: h.document.brand,
    createdAt: h.document.createdAt,
  }));

  // Process facets
  const facets: Record<
    string,
    { label: string; options: { value: string; count: number }[]; stats?: { min: number; max: number; avg: number; sum: number } }
  > = {};
  if (result.facet_counts) {
    result.facet_counts.forEach((fc: SearchResponseFacetCountSchema<ProductDocument>) => {
      facets[fc.field_name as string] = {
        label: fc.field_name as string,
        options: fc.counts.map((c: { value: string; count: number }) => ({
          value: c.value,
          count: c.count,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Typesense stats fields are optional
        ...(fc.stats ? { stats: fc.stats as any } : {}),
      };
    });
  }

  return { hits, total: result.found ?? 0, facets };
}

export async function suggestProducts(
  query: string,
  limit = 5
): Promise<
  Array<{ id: string; slug: string; name: string; imageUrl?: string }>
> {
  const client = getTypesenseClient();
  const result = await client
    .collections(PRODUCTS_COLLECTION)
    .documents()
    .search({
      q: query,
      query_by: "name_es,name_en,sku_list",
      filter_by: "isActive:true",
      per_page: limit,
      prefix: true,
      num_typos: 1,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Typesense generic typing workaround
  return ((result.hits ?? []) as any[]).map((h: SearchResponseHit<ProductDocument>) => ({
    id: h.document.id,
    slug: h.document.slug,
    name: h.document.name_es,
    imageUrl: h.document.imageUrl,
  }));
}

export async function retrieveProductDocument(
  id: string
): Promise<ProductDocument | null> {
  if (!IS_TYPESENSE_ENABLED) return null;
  const client = getTypesenseClient();
  try {
    const doc = await client
      .collections(PRODUCTS_COLLECTION)
      .documents(id)
      .retrieve();
    return doc as unknown as ProductDocument;
  } catch {
    return null;
  }
}
