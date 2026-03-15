import { NextRequest, NextResponse } from "next/server";
import { validateFederationRequest } from "@/lib/federation-auth";
import db from "@/lib/db";

/**
 * GET /api/federation/products?channelId=xxx
 * Return products in a supply channel for downstream instances.
 *
 * Query params:
 *   channelId (required) -- the supply channel to list products from
 *   ids -- comma-separated product IDs for selective sync
 *   updatedAfter -- ISO date string for incremental sync
 */
export async function GET(req: NextRequest) {
  try {
    const rawBody = "";
    const auth = await validateFederationRequest(req, rawBody);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");
    const ids = searchParams.get("ids")?.split(",").filter(Boolean);
    const updatedAfter = searchParams.get("updatedAfter");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    // Verify the channel belongs to this node and is published
    const channel = await db.supplyChannel.findFirst({
      where: {
        id: channelId,
        nodeId: auth.nodeId,
        isPublished: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found or not published" },
        { status: 404 }
      );
    }

    // Build product query
    const channelProducts = await db.channelProduct.findMany({
      where: {
        channelId,
        ...(ids ? { upstreamProductId: { in: ids } } : {}),
      },
      select: {
        upstreamProductId: true,
        upstreamSku: true,
      },
    });

    const productIds = channelProducts.map((cp) => cp.upstreamProductId);

    if (productIds.length === 0) {
      return NextResponse.json({ products: [], total: 0 });
    }

    // Fetch full product data (safe fields only -- no cost prices or internal notes)
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        ...(updatedAfter ? { updatedAt: { gte: new Date(updatedAfter) } } : {}),
      },
      select: {
        id: true,
        slug: true,
        sku: true,
        content: true,
        type: true,
        brand: true,
        hsCode: true,
        category: {
          select: { id: true, slug: true, content: true },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            ean: true,
            price: true,          // RRP (suggested retail)
            b2bPrice: true,       // B2B price
            // NOTE: costPrice is intentionally excluded -- business secret
            specs: true,
            content: true,
          },
        },
        updatedAt: true,
      },
    });

    return NextResponse.json({
      products,
      total: products.length,
      channelId,
    });
  } catch (error) {
    console.error("[federation/products] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
