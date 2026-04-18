import { NextRequest, NextResponse } from "next/server";
import { getUtmAttributionReport, type MetricsWindow } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../../lib/auth";
import { csvResponse, rowsToCsv } from "../../../../../../lib/csv";
import { windowFromRange } from "../../../../../../lib/metrics";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

export async function GET(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "30d";
  const range: RangeKey = (["7d", "30d", "90d", "ytd", "all"] as const).includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "30d";
  const w = windowFromRange(range);
  const window: MetricsWindow = { start: w.start, end: w.end };
  const rows = await getUtmAttributionReport(window);

  const csv = rowsToCsv(
    rows.map((r) => ({
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      acquisition_path: r.acquisition_path,
      samples: r.samples,
      paid_orders: r.paid_orders,
      revenue_usd: (r.revenue_cents / 100).toFixed(2),
      refunded_usd: (r.refunded_cents / 100).toFixed(2),
      unique_customers: r.unique_customers,
      aov_usd: r.paid_orders > 0 ? (r.revenue_cents / r.paid_orders / 100).toFixed(2) : "0.00",
      sample_to_paid_pct: r.samples > 0 ? ((r.paid_orders / r.samples) * 100).toFixed(2) : "",
    })),
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "acquisition_path",
      "samples",
      "paid_orders",
      "revenue_usd",
      "refunded_usd",
      "unique_customers",
      "aov_usd",
      "sample_to_paid_pct",
    ],
  );

  return csvResponse(csv, `attribution-${range}-${new Date().toISOString().slice(0, 10)}.csv`);
}
