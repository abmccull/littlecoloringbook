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
