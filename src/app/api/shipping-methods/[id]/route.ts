import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER", "SALES_REP"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await props.params;
  try {
    const method = await db.shippingMethod.findUnique({
      where: { id: params.id },
    });

    if (!method) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...method,
      price: Number(method.price),
    });
  } catch (error) {
    console.error("Error fetching shipping method:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
