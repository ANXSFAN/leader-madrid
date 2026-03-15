export function generateOrderNumber(prefix: "ORD" | "SO" | "PO" | "PR" | "ST" | "CD" | "DO" | "COUNT" = "ORD"): string {
  const now = new Date();
  // YYYYMMDD
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  // 6 random chars (A-Z, 0-9)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${random}`;
}
