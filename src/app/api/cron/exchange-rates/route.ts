import { NextRequest, NextResponse } from "next/server";
import { fetchECBRates } from "@/lib/services/exchange-rate-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/exchange-rates
 *
 * External cron endpoint to refresh ECB exchange rates.
 * Authenticated via CRON_SECRET env var.
 *
 * Recommended schedule: weekdays CET 16:00 (ECB publish time).
 * Can be called via Vercel Cron or cron-job.org.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchECBRates();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch ECB rates",
      },
      { status: 500 }
    );
  }
}
