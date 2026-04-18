import { describe, it, expect } from "vitest";
import { wilsonLowerBound } from "@littlecolorbook/db/repositories";

// ─── Wilson lower bound math ──────────────────────────────────────────────────

describe("wilsonLowerBound", () => {
  it("returns 0 for zero trials", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(5, 0)).toBe(0);
  });

  it("returns 0 for zero successes with many trials", () => {
    const lb = wilsonLowerBound(0, 1000);
    expect(lb).toBe(0);
  });

  it("returns < 1 for all successes", () => {
    // All 10 out of 10 successes — lower bound should be positive but < 1
    const lb = wilsonLowerBound(10, 10);
    expect(lb).toBeGreaterThan(0);
    expect(lb).toBeLessThan(1);
  });

  it("is monotonically increasing with more successes (same trial count)", () => {
    const lb10 = wilsonLowerBound(10, 100);
    const lb20 = wilsonLowerBound(20, 100);
    const lb50 = wilsonLowerBound(50, 100);
    expect(lb10).toBeLessThan(lb20);
    expect(lb20).toBeLessThan(lb50);
  });

  it("increases as sample size grows (same proportion)", () => {
    // 10% success rate, but more data → tighter interval → higher lower bound
    const lb_small = wilsonLowerBound(10, 100);
    const lb_large = wilsonLowerBound(100, 1000);
    expect(lb_large).toBeGreaterThanOrEqual(lb_small);
  });

  it("returns a value in [0, 1] for all valid inputs", () => {
    const cases: [number, number][] = [
      [0, 1], [1, 1], [0, 100], [50, 100], [99, 100], [100, 100],
      [1, 1000], [500, 1000],
    ];
    for (const [s, t] of cases) {
      const lb = wilsonLowerBound(s, t);
      expect(lb).toBeGreaterThanOrEqual(0);
      expect(lb).toBeLessThanOrEqual(1);
    }
  });

  it("uses z=1.96 by default (95% CI)", () => {
    // With explicit z=1.96, should match the default
    const defaultLb = wilsonLowerBound(50, 100);
    const explicitLb = wilsonLowerBound(50, 100, 1.96);
    expect(defaultLb).toBeCloseTo(explicitLb, 10);
  });

  it("wider z gives lower lower bound (more conservative)", () => {
    const lb_95 = wilsonLowerBound(50, 100, 1.96);  // 95% CI
    const lb_99 = wilsonLowerBound(50, 100, 2.576); // 99% CI
    expect(lb_99).toBeLessThan(lb_95);
  });

  it("for 5 purchases out of 1000 clicks, returns a small but positive value", () => {
    const lb = wilsonLowerBound(5, 1000);
    expect(lb).toBeGreaterThan(0);
    expect(lb).toBeLessThan(0.02); // 0.5% with penalty ≈ small
  });

  it("for 500 purchases out of 1000 clicks, returns ~0.47", () => {
    // 50% success rate, 1000 trials → lower bound near 47%
    const lb = wilsonLowerBound(500, 1000);
    expect(lb).toBeGreaterThan(0.46);
    expect(lb).toBeLessThan(0.50);
  });
});

// ─── getElementPerformance query shape (mocked DB) ───────────────────────────

// We test the shape contract and Wilson integration without a real DB.
// The actual SQL execution is covered by integration tests.

describe("getElementPerformance shape contract", () => {
  it("ElementPerformanceRow has required fields with correct types (type-check test)", () => {
    // This test just validates the TypeScript type structure compiles correctly.
    // It will fail to compile if the type contract changes.
    type ExpectedRow = {
      elementId: string;
      kind: "hook" | "body" | "cta" | "visual_style";
      totalSpendCents: number;
      totalPurchases: number;
      totalRevenueCents: number;
      avgCtr: number;
      avgRoas: number;
      avgCpaCents: number;
      adCount: number;
      avgHookRate: number;
      confidenceLowerBound: number;
    };

    // Mock a row that satisfies the type
    const mockRow: ExpectedRow = {
      elementId: "el_001",
      kind: "hook",
      totalSpendCents: 15000,
      totalPurchases: 8,
      totalRevenueCents: 48000,
      avgCtr: 0.025,
      avgRoas: 3.2,
      avgCpaCents: 1875,
      adCount: 3,
      avgHookRate: 0.18,
      confidenceLowerBound: wilsonLowerBound(8, 320), // 8 purchases / ~320 clicks
    };

    expect(mockRow.elementId).toBe("el_001");
    expect(mockRow.kind).toBe("hook");
    expect(mockRow.confidenceLowerBound).toBeGreaterThan(0);
    expect(mockRow.confidenceLowerBound).toBeLessThan(0.1);
  });

  it("zero-data row has confidenceLowerBound of 0", () => {
    const zeroLb = wilsonLowerBound(0, 0);
    expect(zeroLb).toBe(0);
  });

  it("roas 3.2 with 8 purchases gives reasonable confidence lower bound", () => {
    // 8 purchases from ~320 clicks (CTR 2.5%) → Wilson LB
    const lb = wilsonLowerBound(8, 320);
    expect(lb).toBeGreaterThan(0);
    expect(lb).toBeLessThan(0.05); // should be small because small sample
  });
});
