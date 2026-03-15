import { NextRequest, NextResponse } from "next/server";
import { validateFederationRequest } from "@/lib/federation-auth";
import db from "@/lib/db";

/**
 * GET /api/federation/inventory?variantIds=id1,id2,...
 * Return available stock for specified variants.
 * Only exposes available quantity, not physical stock or cost details.
 */
export async function GET(req: NextRequest) {
  try {
    const rawBody = "";
    const auth = await validateFederationRequest(req, rawBody);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const variantIds = searchParams.get("variantIds")?.split(",").filter(Boolean);

    if (!variantIds || variantIds.length === 0) {
      return NextResponse.json(
        { error: "variantIds parameter is required" },
        { status: 400 }
      );
    }

    // Cap at 100 variants per request
    const limitedIds = variantIds.slice(0, 100);

    // Aggregate stock across all warehouses
    const stocks = await db.warehouseStock.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: limitedIds },
      },
      _sum: {
        physicalStock: true,
        allocatedStock: true,
      },
    });

    // Get variant info
    const variants = await db.productVariant.findMany({
      where: { id: { in: limitedIds } },
      select: {
        id: true,
        sku: true,
        leadTimeDays: true,
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const items = stocks.map((s) => {
      const variant = variantMap.get(s.variantId);
      const physical = s._sum.physicalStock || 0;
      const allocated = s._sum.allocatedStock || 0;
      return {
        variantId: s.variantId,
        sku: variant?.sku || "",
        availableQty: Math.max(0, physical - allocated),
        leadTimeDays: variant?.leadTimeDays || 14,
        lastUpdated: new Date().toISOString(),
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[federation/inventory] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
