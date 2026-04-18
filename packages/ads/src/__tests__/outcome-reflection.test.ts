import { describe, it, expect } from "vitest";
import { computeOutcomeDelta } from "../outcome-reflection";
import type { MetricsSummary } from "../outcome-reflection";

function makeSummary(overrides: Partial<MetricsSummary> = {}): MetricsSummary {
  return {
    totalImpressions: 1000,
    totalSpendCents: 5000,
    totalPurchases: 5,
    avgCtr: 0.03,
    avgCpmCents: 500,
    avgCpaCents: 1000,
    roas: 2.0,
    ...overrides,
  };
}

describe("computeOutcomeDelta", () => {
  it("returns 'improved' when ROAS increases >5%", () => {
    const baseline = makeSummary({ roas: 2.0 });
    const current = makeSummary({ roas: 2.5 });
    const { direction, delta } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("improved");
    expect(delta.roas).toBeCloseTo(0.5);
    expect(delta.roas_relative_pct).toBeCloseTo(25);
  });

  it("returns 'worsened' when ROAS decreases >5%", () => {
    const baseline = makeSummary({ roas: 2.0 });
    const current = makeSummary({ roas: 1.5 });
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("worsened");
  });

  it("returns 'flat' when ROAS change is within 5% noise threshold", () => {
    const baseline = makeSummary({ roas: 2.0, avgCpaCents: 1000, avgCtr: 0.03 });
    const current = makeSummary({ roas: 2.04, avgCpaCents: 1000, avgCtr: 0.03 });
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("flat");
  });

  it("uses CPA tiebreaker when ROAS is null on both sides but CPA improves", () => {
    const baseline = makeSummary({ roas: null, avgCpaCents: 2000, avgCtr: 0.03 });
    const current = makeSummary({ roas: null, avgCpaCents: 1500, avgCtr: 0.03 });
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("improved");
  });

  it("uses CTR tiebreaker when both ROAS and CPA are flat", () => {
    const baseline = makeSummary({ roas: null, avgCpaCents: 1000, avgCtr: 0.02 });
    const current = makeSummary({ roas: null, avgCpaCents: 1000, avgCtr: 0.03 });
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("improved");
  });

  it("always includes spend and purchases in delta", () => {
    const baseline = makeSummary({ totalSpendCents: 5000, totalPurchases: 5, totalImpressions: 1000 });
    const current = makeSummary({ totalSpendCents: 7000, totalPurchases: 8, totalImpressions: 1500 });
    const { delta } = computeOutcomeDelta(baseline, current);
    expect(delta.spend_cents).toBe(2000);
    expect(delta.purchases).toBe(3);
    expect(delta.impressions).toBe(500);
  });

  it("returns 'flat' when all signals are null or within threshold", () => {
    const baseline = makeSummary({ roas: null, avgCpaCents: null, avgCtr: null });
    const current = makeSummary({ roas: null, avgCpaCents: null, avgCtr: null });
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("flat");
  });
});

// ─── Round-trip tests: SQL → MetricsSummary → computeOutcomeDelta ─────────────
// These verify that the MetricsSummary shape produced by getEntityMetricsSummary
// (aggregated from daily_metrics rows) is accepted by computeOutcomeDelta without
// type errors and produces meaningful output. The summaries here mirror the shape
// that the SQL aggregation returns.

describe("computeOutcomeDelta — realistic MetricsSummary round-trips", () => {
  it("handles a real ad improvement: spend up, CPA down, ROAS up", () => {
    const baseline: MetricsSummary = {
      totalImpressions: 12_000,
      totalSpendCents: 45_00,   // $45
      totalPurchases: 2,
      avgCtr: 0.025,
      avgCpmCents: 375,
      avgCpaCents: 2250,
      roas: 1.8,
    };
    const current: MetricsSummary = {
      totalImpressions: 18_000,
      totalSpendCents: 60_00,   // $60
      totalPurchases: 5,
      avgCtr: 0.031,
      avgCpmCents: 333,
      avgCpaCents: 1200,
      roas: 2.7,
    };
    const { direction, delta } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("improved");
    expect(delta.spend_cents).toBe(1500);
    expect(delta.purchases).toBe(3);
    expect(delta.roas_relative_pct).toBeCloseTo(50, 0);
  });

  it("handles zero-spend baseline (new ad, no history) without divide-by-zero", () => {
    const baseline: MetricsSummary = {
      totalImpressions: 0,
      totalSpendCents: 0,
      totalPurchases: 0,
      avgCtr: null,
      avgCpmCents: null,
      avgCpaCents: null,
      roas: null,
    };
    const current: MetricsSummary = {
      totalImpressions: 5_000,
      totalSpendCents: 20_00,
      totalPurchases: 1,
      avgCtr: 0.02,
      avgCpmCents: 400,
      avgCpaCents: 2000,
      roas: 1.5,
    };
    // ROAS goes from null → value, relativeDelta returns null, so falls through to tiebreaker.
    // CPA: null before → no CPA signal. CTR: null before → no CTR signal. Direction is flat.
    const { direction } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("flat");
  });

  it("handles adset-level summary (same shape as ad-level) correctly", () => {
    // adset and campaign summaries share the AdMetricsSummary shape — verify
    // computeOutcomeDelta accepts them without type issues.
    const baseline: MetricsSummary = {
      totalImpressions: 50_000,
      totalSpendCents: 200_00,
      totalPurchases: 10,
      avgCtr: 0.018,
      avgCpmCents: 400,
      avgCpaCents: 2000,
      roas: 2.0,
    };
    const current: MetricsSummary = {
      totalImpressions: 48_000,
      totalSpendCents: 200_00,
      totalPurchases: 8,
      avgCtr: 0.015,
      avgCpmCents: 417,
      avgCpaCents: 2500,
      roas: 1.6,
    };
    const { direction, delta } = computeOutcomeDelta(baseline, current);
    expect(direction).toBe("worsened");
    expect(delta.roas_relative_pct).toBeCloseTo(-20, 0);
  });

  it("produces cpa_relative_pct that matches manual calculation", () => {
    const baseline: MetricsSummary = {
      totalImpressions: 10_000,
      totalSpendCents: 30_00,
      totalPurchases: 3,
      avgCtr: null,
      avgCpmCents: null,
      avgCpaCents: 1000,
      roas: null,
    };
    const current: MetricsSummary = {
      totalImpressions: 10_000,
      totalSpendCents: 30_00,
      totalPurchases: 3,
      avgCtr: null,
      avgCpmCents: null,
      avgCpaCents: 880,
      roas: null,
    };
    const { direction, delta } = computeOutcomeDelta(baseline, current);
    // CPA dropped 12% — improved (lower CPA = better)
    expect(direction).toBe("improved");
    expect(delta.cpa_relative_pct).toBeCloseTo(-12, 0);
  });
});
