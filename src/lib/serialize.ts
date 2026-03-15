import { Decimal } from "@prisma/client/runtime/library";

/**
 * Recursively converts Prisma Decimal objects to plain numbers
 * so they can be safely passed from Server Components to Client Components.
 * React 19 enforces that only plain objects are passed across the boundary.
 */
export function serializeDecimal<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Decimal) return Number(obj) as unknown as T;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(serializeDecimal) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDecimal(value);
    }
    return result as T;
  }
  return obj;
}
