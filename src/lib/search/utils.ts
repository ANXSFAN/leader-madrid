import { ProductDocument } from "./typesense-client";
import type { Product, ProductVariant, Category } from "@prisma/client";

type ProductWithRelations = Product & {
  variants: ProductVariant[];
  category?: Category | null;
};

interface CategoryMapEntry {
  slug: string;
  parentId: string | null;
}

// Helper to clean numeric values from strings (e.g., "10W" -> 10)
export function parseNumber(val: string | number | null | undefined): number | undefined {
  if (typeof val === "number") return val;
  if (!val) return undefined;
  const match = val.toString().match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : undefined;
}

export function toProductDocument(
  product: ProductWithRelations,
  categoryMap: Map<string, CategoryMapEntry>
): ProductDocument {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JsonValue needs runtime access
  const content = product.content as any;
  const nameEs = content?.es?.name || content?.name || product.slug;
  const nameEn = content?.en?.name;
  const descEs = content?.es?.description || content?.description;
  const images =
    content?.es?.images || content?.en?.images || content?.images || [];
  const imageUrl =
    Array.isArray(images) && images.length > 0 ? images[0] : undefined;
  const imageList = Array.isArray(images) ? images : imageUrl ? [imageUrl] : [];

  const prices = (product.variants ?? [])
    .map((v: ProductVariant) => Number(v.price))
    .filter((p: number) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Calculate compareAtPrice for filtering (only if > price)
  const compareAtPrices = (product.variants ?? [])
    .filter(
      (v: ProductVariant) => v.compareAtPrice && Number(v.compareAtPrice) > Number(v.price)
    )
    .map((v: ProductVariant) => Number(v.compareAtPrice));
  const compareAtPrice =
    compareAtPrices.length > 0 ? Math.min(...compareAtPrices) : undefined;

  const totalStock = (product.variants ?? []).reduce(
    (sum: number, v: ProductVariant) => sum + (v.physicalStock ?? 0),
    0
  );
  const skuList = (product.variants ?? [])
    .map((v: ProductVariant) => v.sku)
    .filter(Boolean);

  // Serialize variants for client-side use without DB
  const variantsJson = JSON.stringify(
    (product.variants ?? []).map((v: ProductVariant) => ({
      id: v.id,
      sku: v.sku,
      price: Number(v.price),
      b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : undefined,
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
      physicalStock: v.physicalStock,
      allocatedStock: v.allocatedStock,
      specs: v.specs,
    }))
  );

  // Generate category path (with cycle protection)
  const categoryPath: string[] = [];
  const visitedCatIds = new Set<string>();
  let currentCatId = product.categoryId;
  while (currentCatId) {
    if (visitedCatIds.has(currentCatId)) break; // Prevent infinite loop on circular references
    visitedCatIds.add(currentCatId);
    const cat = categoryMap.get(currentCatId);
    if (!cat) break;
    categoryPath.unshift(cat.slug);
    currentCatId = cat.parentId;
  }

  // Extract attributes from variants
  const wattage = new Set<number>();
  const colorTemp = new Set<string>();
  const ipRating = new Set<string>();
  const lumens = new Set<number>();
  const cri = new Set<number>();
  const specsKv = new Set<string>();

  for (const v of product.variants ?? []) {
    const specs = v.specs as Record<string, unknown> | null;
    if (!specs) continue;

    Object.entries(specs).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item === null || item === undefined) return;
          specsKv.add(`${key}=${String(item)}`);
        });
        return;
      }
      if (typeof value === "object") return;
      specsKv.add(`${key}=${String(value)}`);
    });

    // Wattage / Power
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- specs values are dynamic JSON
    const w = parseNumber((specs as any).wattage || (specs as any).power);
    if (w !== undefined) wattage.add(w);

    // Color Temp / CCT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- specs values are dynamic JSON
    const s = specs as any;
    const cct = s.cct || s.color_temp || s.colorTemp;
    if (cct) colorTemp.add(cct.toString());

    // IP Rating
    const ip = s.ip || s.ip_rating || s.ipRating;
    if (ip) ipRating.add(ip.toString());

    // Lumens
    const lm = parseNumber(
      s.lumens || s.luminous_flux || s.luminousFlux
    );
    if (lm !== undefined) lumens.add(lm);

    // CRI
    const c = parseNumber(s.cri);
    if (c !== undefined) cri.add(c);
  }

  return {
    id: product.id,
    name_es: nameEs,
    name_en: nameEn,
    description_es: descEs,
    slug: product.slug,
    sku_list: skuList,
    brand: product.brand ?? undefined,
    categorySlug: product.category?.slug,
    category_path: categoryPath,
    categoryName:
      categoryPath.length > 0
        ? categoryPath[categoryPath.length - 1]
        : undefined,
    minPrice,
    maxPrice,
    prices: prices.length > 0 ? prices : [0],
    compareAtPrice,
    createdAt: new Date(product.createdAt).getTime(),
    isActive: product.isActive,
    totalStock,
    imageUrl,
    images: imageList,
    variants_json: variantsJson,
    wattage: Array.from(wattage),
    color_temp: Array.from(colorTemp),
    ip_rating: Array.from(ipRating),
    lumens: Array.from(lumens),
    cri: Array.from(cri),
    specs_kv: Array.from(specsKv),
    sortOrder: product.sortOrder ?? 0,
  };
}
