import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "../../../../../lib/auth";
import { computeDashboardMetrics } from "../../../../../lib/metrics";

export const dynamic = "force-dynamic";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

/**
 * Lightweight JSON poll for the live-refresh tiles on /admin/metrics.
 * Returns the same shape as the server-rendered page so the client can
 * swap numbers in place. We kept this as a plain poll (10s default) —
 * SSE would be marginally cooler but fights Vercel serverless timeouts
 * and needs a pub/sub bus to be meaningful. For tile counts, polling is
 * the honest answer.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "30d";
  const range: RangeKey = (["7d", "30d", "90d", "ytd", "all"] as const).includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "30d";

  const metrics = await computeDashboardMetrics(range);
  return NextResponse.json({ range, metrics, fetchedAt: new Date().toISOString() });
}
