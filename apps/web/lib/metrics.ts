import "server-only";

import {
  countNewPayingCustomers,
  getGeminiCostInWindow,
  getOrderBreakdown,
  getRepeatCustomerStats,
  getRevenueMetrics,
  getSampleToPaidFunnel,
  sumAdSpendInWindow,
  type MetricsWindow,
} from "@littlecolorbook/db";

const STRIPE_FEE_PCT = 0.029;
const STRIPE_FEE_FLAT_CENTS = 30;
const LULU_PRINT_COST_RATIO = 0.4; // best-effort estimate; refine once we log Lulu cost per job

export type DashboardMetrics = {
  window: { start: string; end: string; label: string };
  revenue: {
    grossCents: number;
    refundedCents: number;
    netCents: number;
  };
  orders: {
    totalOrders: number;
    paidOrders: number;
    pdfOrders: number;
    printOrders: number;
    samples: number;
    refundedOrders: number;
    refundRatePct: number;
  };
  costs: {
    adSpendCents: number;
    geminiTotalCents: number;
    geminiSampleCents: number;
    geminiPaidCents: number;
    stripeFeeCents: number;
    luluEstimateCents: number;
    totalCents: number;
  };
  unit: {
    aovCents: number;
    costPerSampleCents: number;
    cacCents: number;
    newPayingCustomers: number;
    profitMarginPct: number;
    grossMarginCents: number;
  };
  funnel: {
    samplesCreated: number;
    samplesToPaid: number;
    sampleConversionPct: number;
  };
  retention: {
    payingCustomers: number;
    repeatCustomers: number;
    repeatOrderRatePct: number;
    ltvCents: number;
  };
  fulfillment: {
    pendingAssembly: number;
    awaitingPrintSubmission: number;
    inProduction: number;
    shipped: number;
    delivered: number;
  };
};

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // two decimals
}

export function windowFromRange(range: "7d" | "30d" | "90d" | "ytd" | "all"): MetricsWindow & { label: string } {
  const end = new Date();
  const start = new Date(end);
  let label = "";
  switch (range) {
    case "7d":
      start.setUTCDate(end.getUTCDate() - 7);
      label = "Last 7 days";
      break;
    case "30d":
      start.setUTCDate(end.getUTCDate() - 30);
      label = "Last 30 days";
      break;
    case "90d":
      start.setUTCDate(end.getUTCDate() - 90);
      label = "Last 90 days";
      break;
    case "ytd":
      start.setUTCMonth(0, 1);
      start.setUTCHours(0, 0, 0, 0);
      label = "Year to date";
      break;
    case "all":
    default:
      start.setUTCFullYear(end.getUTCFullYear() - 5);
      label = "All time";
      break;
  }
  return { start, end, label };
}

export async function computeDashboardMetrics(
  range: "7d" | "30d" | "90d" | "ytd" | "all",
): Promise<DashboardMetrics> {
  const w = windowFromRange(range);
  const window: MetricsWindow = { start: w.start, end: w.end };

  const [revenue, breakdown, gemini, adSpend, funnel, repeat, newPaying] = await Promise.all([
    getRevenueMetrics(window),
    getOrderBreakdown(window),
    getGeminiCostInWindow(window),
    sumAdSpendInWindow(window),
    getSampleToPaidFunnel(window),
    getRepeatCustomerStats(window),
    countNewPayingCustomers(window),
  ]);

  const netCents = Math.max(0, revenue.gross_cents - revenue.refunded_cents);
  const stripeFeeCents = revenue.paid_order_count > 0
    ? Math.round(revenue.gross_cents * STRIPE_FEE_PCT + STRIPE_FEE_FLAT_CENTS * revenue.paid_order_count)
    : 0;
  // Rough Lulu estimate: print_count * avg_print_order_revenue * 40%. We
  // don't have per-order Lulu cost yet.
  const avgPrintRevenueCents = breakdown.print_count > 0 ? Math.round(revenue.gross_cents / Math.max(1, revenue.paid_order_count)) : 0;
  const luluEstimateCents = Math.round(breakdown.print_count * avgPrintRevenueCents * LULU_PRINT_COST_RATIO);

  const totalCostsCents = adSpend + gemini.total_cost_cents + stripeFeeCents + luluEstimateCents;
  const grossMarginCents = netCents - totalCostsCents;

  const costPerSampleCents = funnel.samples_created > 0
    ? Math.round((adSpend + gemini.sample_cost_cents) / funnel.samples_created)
    : 0;
  const cacCents = newPaying > 0 ? Math.round(adSpend / newPaying) : 0;

  return {
    window: { start: w.start.toISOString(), end: w.end.toISOString(), label: w.label },
    revenue: {
      grossCents: revenue.gross_cents,
      refundedCents: revenue.refunded_cents,
      netCents,
    },
    orders: {
      totalOrders: revenue.total_order_count,
      paidOrders: revenue.paid_order_count,
      pdfOrders: breakdown.pdf_count,
      printOrders: breakdown.print_count,
      samples: breakdown.sample_count,
      refundedOrders: breakdown.refunded_order_count,
      refundRatePct: pct(breakdown.refunded_order_count, revenue.paid_order_count),
    },
    costs: {
      adSpendCents: adSpend,
      geminiTotalCents: gemini.total_cost_cents,
      geminiSampleCents: gemini.sample_cost_cents,
      geminiPaidCents: gemini.paid_cost_cents,
      stripeFeeCents,
      luluEstimateCents,
      totalCents: totalCostsCents,
    },
    unit: {
      aovCents: revenue.paid_order_count > 0 ? Math.round(revenue.gross_cents / revenue.paid_order_count) : 0,
      costPerSampleCents,
      cacCents,
      newPayingCustomers: newPaying,
      profitMarginPct: netCents > 0 ? pct(grossMarginCents, netCents) : 0,
      grossMarginCents,
    },
    funnel: {
      samplesCreated: funnel.samples_created,
      samplesToPaid: funnel.samples_to_paid,
      sampleConversionPct: pct(funnel.samples_to_paid, funnel.samples_created),
    },
    retention: {
      payingCustomers: repeat.paying_customers,
      repeatCustomers: repeat.repeat_customers,
      repeatOrderRatePct: pct(repeat.repeat_customers, repeat.paying_customers),
      ltvCents: repeat.paying_customers > 0 ? Math.round(repeat.total_paid_revenue_cents / repeat.paying_customers) : 0,
    },
    fulfillment: {
      pendingAssembly: breakdown.pending_assembly,
      awaitingPrintSubmission: breakdown.awaiting_print_submission,
      inProduction: breakdown.in_production,
      shipped: breakdown.shipped,
      delivered: breakdown.delivered,
    },
  };
}
