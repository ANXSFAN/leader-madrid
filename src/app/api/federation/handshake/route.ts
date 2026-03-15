import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateApiKey, generateApiSecret } from "@/lib/federation-auth";

/**
 * POST /api/federation/handshake
 * Accept a connection request from another ERP instance.
 *
 * Body: { nodeCode, nodeName, nodeType, baseUrl, inboundKey }
 *
 * This creates a new FederationNode record for the remote instance.
 * The remote instance's inboundKey becomes our apiKey for calling them.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodeCode, nodeName, nodeType, baseUrl, inboundKey } = body;

    if (!nodeCode || !nodeName || !nodeType || !baseUrl || !inboundKey) {
      return NextResponse.json(
        { error: "Missing required fields: nodeCode, nodeName, nodeType, baseUrl, inboundKey" },
        { status: 400 }
      );
    }

    // Check if node with this code already exists
    const existing = await db.federationNode.findUnique({
      where: { code: nodeCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Node with this code already exists" },
        { status: 409 }
      );
    }

    // Generate our own keys for this relationship
    const ourInboundKey = generateApiKey();
    const apiSecret = generateApiSecret();

    // Create the node — starts as PENDING, admin must approve
    const node = await db.federationNode.create({
      data: {
        name: nodeName,
        code: nodeCode,
        type: nodeType,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiKey: inboundKey, // Their inbound key = our outbound key
        apiSecret,
        inboundKey: ourInboundKey, // Our inbound key for them to use
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        nodeCode: node.code,
        inboundKey: ourInboundKey, // They need this to call us
        apiSecret, // Shared secret for HMAC signing
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[federation/handshake] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
