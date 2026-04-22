import { NextRequest, NextResponse } from "next/server";
import { getDailyRevenueSeries } from "@littlecolorbook/db";
import { requireAdminApiSession } from "../../../../../lib/auth";
import { csvResponse, rowsToCsv } from "../../../../../lib/csv";
import { computeDashboardMetrics, windowFromRange } from "../../../../../lib/metrics";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

export async function GET(request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "30d";
  const validRanges: RangeKey[] = ["7d", "30d", "90d", "ytd", "all"];
  const range = (validRanges as string[]).includes(rangeParam) ? (rangeParam as RangeKey) : "30d";

  const format = request.nextUrl.searchParams.get("format") ?? "daily";
  const metrics = await computeDashboardMetrics(range);

  if (format === "summary") {
    // One-row summary export with every KPI.
    const row = {
      window_start: metrics.window.start,
      window_end: metrics.window.end,
      window_label: metrics.window.label,
      gross_revenue_usd: (metrics.revenue.grossCents / 100).toFixed(2),
      refunded_usd: (metrics.revenue.refundedCents / 100).toFixed(2),
      net_revenue_usd: (metrics.revenue.netCents / 100).toFixed(2),
      gross_margin_usd: (metrics.unit.grossMarginCents / 100).toFixed(2),
      profit_margin_pct: metrics.unit.profitMarginPct.toFixed(2),
      paid_orders: metrics.orders.paidOrders,
      aov_usd: (metrics.unit.aovCents / 100).toFixed(2),
      pdf_orders: metrics.orders.pdfOrders,
      print_orders: metrics.orders.printOrders,
      samples: metrics.orders.samples,
      refunded_orders: metrics.orders.refundedOrders,
      refund_rate_pct: metrics.orders.refundRatePct.toFixed(2),
      samples_created: metrics.funnel.samplesCreated,
      samples_to_paid: metrics.funnel.samplesToPaid,
      sample_conversion_pct: metrics.funnel.sampleConversionPct.toFixed(2),
      ad_spend_usd: (metrics.costs.adSpendCents / 100).toFixed(2),
      ad_spend_meta_synced_usd: (metrics.costs.adSpendMetaSyncedCents / 100).toFixed(2),
      ad_spend_manual_usd: (metrics.costs.adSpendManualCents / 100).toFixed(2),
      ad_spend_meta_source: metrics.costs.adSpendMetaSourceLevel ?? "",
      new_paying_customers: metrics.unit.newPayingCustomers,
      cac_usd: (metrics.unit.cacCents / 100).toFixed(2),
      cost_per_sample_usd: (metrics.unit.costPerSampleCents / 100).toFixed(2),
      gemini_total_usd: (metrics.costs.geminiTotalCents / 100).toFixed(2),
      gemini_sample_usd: (metrics.costs.geminiSampleCents / 100).toFixed(2),
      gemini_paid_usd: (metrics.costs.geminiPaidCents / 100).toFixed(2),
      stripe_fees_usd: (metrics.costs.stripeFeeCents / 100).toFixed(2),
      lulu_actual_usd: (metrics.costs.luluActualCents / 100).toFixed(2),
      lulu_quoted_usd: (metrics.costs.luluQuotedCents / 100).toFixed(2),
      lulu_fallback_usd: (metrics.costs.luluFallbackCents / 100).toFixed(2),
      lulu_cost_usd: (metrics.costs.luluTotalCents / 100).toFixed(2),
      total_costs_usd: (metrics.costs.totalCents / 100).toFixed(2),
      paying_customers: metrics.retention.payingCustomers,
      repeat_customers: metrics.retention.repeatCustomers,
      repeat_order_rate_pct: metrics.retention.repeatOrderRatePct.toFixed(2),
      ltv_usd: (metrics.retention.ltvCents / 100).toFixed(2),
    };
    const csv = rowsToCsv([row], Object.keys(row) as (keyof typeof row)[]);
    return csvResponse(csv, `metrics-summary-${range}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const window = windowFromRange(range);
  const series = await getDailyRevenueSeries({ start: window.start, end: window.end });
  const csv = rowsToCsv(
    series.map((row) => ({
      day: row.day,
      revenue_usd: (row.revenue_cents / 100).toFixed(2),
      paid_orders: row.paid_orders,
      samples: row.samples,
    })),
    ["day", "revenue_usd", "paid_orders", "samples"],
  );
  return csvResponse(csv, `metrics-daily-${range}-${new Date().toISOString().slice(0, 10)}.csv`);
}
