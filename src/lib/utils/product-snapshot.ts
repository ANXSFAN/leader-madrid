/**
 * Product snapshot helpers.
 *
 * When displaying order / invoice / return items, prefer the snapshot fields
 * stored directly on the item row. Fall back to the live relation only when
 * the snapshot is missing (legacy data before backfill).
 */

/** Resolve product name: snapshot → localized content → slug */
export function getItemProductName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts Prisma JsonValue or plain objects
  item: {
    name?: string | null;
    variant?: {
      product?: { content?: any; slug?: string };
      sku?: string;
    } | null;
  },
  locale: string = "en"
): string {
  if (item.name) return item.name;

  const content = item.variant?.product?.content as Record<string, Record<string, string>> | null;
  if (content) {
    const localized = content[locale] || content.en || content.es;
    if (localized?.name) return localized.name;
    if ((content as Record<string, unknown>).name) return (content as Record<string, unknown>).name as string;
  }

  return item.variant?.product?.slug || item.variant?.sku || "—";
}

/** Resolve product image URL: snapshot → content images → placeholder */
export function getItemProductImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts Prisma JsonValue or plain objects
  item: {
    image?: string | null;
    variant?: {
      product?: { content?: any };
    } | null;
  }
): string {
  if (item.image) return item.image;

  try {
    const content = item.variant?.product?.content as Record<string, unknown> | null;
    if (content) {
      const images = content.images as unknown[] | undefined;
      if (Array.isArray(images) && images.length > 0) {
        const first = images[0] as any;
        if (typeof first === "string") return first;
        if (first?.url) return first.url;
      }
    }
  } catch {}

  return "/placeholder-image.jpg";
}

/** Resolve SKU: snapshot → variant.sku → "—" */
export function getItemSku(
  item: {
    sku?: string | null;
    variant?: { sku?: string } | null;
  }
): string {
  return item.sku || item.variant?.sku || "—";
}
