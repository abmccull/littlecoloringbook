import { describe, it, expect } from "vitest";
import {
  sampleBeta,
  thompsonSample,
  topK,
  confidenceInterval95,
  retirementCandidates,
  hotStreakCandidates,
} from "../thompson-sampling";
import type { BanditArm } from "../thompson-sampling";

// ─── Deterministic RNG (mulberry32) ───────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeArm(id: string, alpha: number, beta: number, extra: Partial<BanditArm> = {}): BanditArm {
  return {
    id,
    alpha,
    beta,
    sampleCount: alpha + beta - 2,
    priorAlpha: 1,
    priorBeta: 1,
    ...extra,
  };
}

// ─── sampleBeta ───────────────────────────────────────────────────────────────

describe("sampleBeta", () => {
  it("returns values in [0, 1] over 1000 trials", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const val = sampleBeta(2, 5, rng);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it("concentrates around α/(α+β) as n grows", () => {
    const rng = mulberry32(99);
    const alpha = 80;
    const beta = 20;
    const expectedMean = alpha / (alpha + beta); // 0.8
    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) {
      samples.push(sampleBeta(alpha, beta, rng));
    }
    const empiricalMean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(empiricalMean).toBeCloseTo(expectedMean, 1); // within 0.05
  });

  it("Beta(1,1) is approximately uniform (mean ~ 0.5)", () => {
    const rng = mulberry32(7);
    const samples: number[] = [];
    for (let i = 0; i < 2000; i++) {
      samples.push(sampleBeta(1, 1, rng));
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it("throws when alpha <= 0", () => {
    expect(() => sampleBeta(0, 1, mulberry32(1))).toThrow();
  });

  it("throws when beta <= 0", () => {
    expect(() => sampleBeta(1, 0, mulberry32(1))).toThrow();
  });
});

// ─── thompsonSample ───────────────────────────────────────────────────────────

describe("thompsonSample", () => {
  it("throws on empty arms", () => {
    expect(() => thompsonSample([], mulberry32(1))).toThrow();
  });

  it("returns an id from the provided arms", () => {
    const arms = [makeArm("a", 2, 8), makeArm("b", 5, 5), makeArm("c", 8, 2)];
    const rng = mulberry32(42);
    const winner = thompsonSample(arms, rng);
    expect(["a", "b", "c"]).toContain(winner);
  });

  it("picks the dominant arm >95% of the time across 1000 trials", () => {
    // arm 'winner' has 90 successes / 10 failures → Beta(91,11) ~ mean 0.89
    // arm 'loser_a' has 2 successes / 20 failures → Beta(3,21) ~ mean 0.125
    // arm 'loser_b' has 1 success / 30 failures → Beta(2,31) ~ mean 0.06
    const arms = [
      makeArm("winner", 91, 11),
      makeArm("loser_a", 3, 21),
      makeArm("loser_b", 2, 31),
    ];
    let winnerCount = 0;
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      if (thompsonSample(arms, rng) === "winner") winnerCount++;
    }
    expect(winnerCount).toBeGreaterThan(950);
  });

  it("returns the only arm when there is exactly one", () => {
    const arms = [makeArm("solo", 5, 5)];
    const rng = mulberry32(1);
    expect(thompsonSample(arms, rng)).toBe("solo");
  });
});

// ─── topK ─────────────────────────────────────────────────────────────────────

describe("topK", () => {
  it("returns k distinct ids", () => {
    const arms = [makeArm("a", 2, 8), makeArm("b", 5, 5), makeArm("c", 8, 2), makeArm("d", 6, 4)];
    const rng = mulberry32(42);
    const result = topK(arms, 3, rng);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    for (const id of result) {
      expect(["a", "b", "c", "d"]).toContain(id);
    }
  });

  it("returns all arms when k >= arms.length", () => {
    const arms = [makeArm("a", 2, 8), makeArm("b", 5, 5)];
    const rng = mulberry32(1);
    const result = topK(arms, 10, rng);
    expect(result).toHaveLength(2);
  });

  it("returns empty when arms is empty", () => {
    expect(topK([], 5, mulberry32(1))).toEqual([]);
  });

  it("returns 1 id for k=1", () => {
    const arms = [makeArm("a", 2, 8), makeArm("b", 5, 5), makeArm("c", 8, 2)];
    const rng = mulberry32(7);
    const result = topK(arms, 1, rng);
    expect(result).toHaveLength(1);
    expect(["a", "b", "c"]).toContain(result[0]);
  });
});

// ─── confidenceInterval95 ─────────────────────────────────────────────────────

describe("confidenceInterval95", () => {
  it("Beta(10,10) is centered at 0.5 with symmetric bounds", () => {
    const { lower, mean, upper } = confidenceInterval95(10, 10);
    expect(mean).toBeCloseTo(0.5, 5);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeLessThan(1);
    // Symmetry: deviation from mean should be equal for lower and upper
    expect(upper - mean).toBeCloseTo(mean - lower, 4);
  });

  it("lower < mean < upper for skewed Beta(1, 20)", () => {
    const { lower, mean, upper } = confidenceInterval95(1, 20);
    expect(lower).toBeLessThan(mean);
    expect(mean).toBeLessThan(upper);
    // mean should be around 1/21 ≈ 0.048
    expect(mean).toBeCloseTo(1 / 21, 3);
  });

  it("clamps lower to >= 0 and upper to <= 1", () => {
    // Very strong prior on one side
    const hi = confidenceInterval95(1000, 1);
    expect(hi.upper).toBeLessThanOrEqual(1);
    const lo = confidenceInterval95(1, 1000);
    expect(lo.lower).toBeGreaterThanOrEqual(0);
  });

  it("Beta(50, 50) mean is 0.5", () => {
    const { mean } = confidenceInterval95(50, 50);
    expect(mean).toBeCloseTo(0.5, 5);
  });
});

// ─── retirementCandidates ─────────────────────────────────────────────────────

describe("retirementCandidates", () => {
  it("flags arms with enough spend and upper bound below threshold", () => {
    // arm 'bad': spent $100, only 0 purchases / many clicks → upper bound very low
    const arms = [
      { ...makeArm("bad", 1, 200), spendCents: 10_000 }, // 1 α, 200 β → upper ≈ 0.016
      { ...makeArm("good", 10, 20), spendCents: 10_000 }, // 10 α, 20 β → upper ≈ 0.44
      { ...makeArm("new", 1, 5), spendCents: 1_000 },  // insufficient spend
    ];
    const result = retirementCandidates(arms, { minSpendCents: 5000, maxUpperBound: 0.02 });
    expect(result).toContain("bad");
    expect(result).not.toContain("good");
    expect(result).not.toContain("new"); // below spend floor
  });

  it("does not flag arms below the spend floor", () => {
    const arms = [
      { ...makeArm("underspent", 1, 200), spendCents: 100 },
    ];
    const result = retirementCandidates(arms, { minSpendCents: 5000, maxUpperBound: 0.02 });
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no arms qualify", () => {
    const arms = [
      { ...makeArm("ok", 10, 10), spendCents: 10_000 },
    ];
    const result = retirementCandidates(arms);
    expect(result).toHaveLength(0);
  });
});

// ─── hotStreakCandidates ──────────────────────────────────────────────────────

describe("hotStreakCandidates", () => {
  function recentDate(hoursAgo: number): Date {
    return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  }

  it("flags arms with high lower bound used recently", () => {
    const arms = [
      { ...makeArm("hot", 50, 10), lastUsedAt: recentDate(24) },  // lower ≈ 0.75
      { ...makeArm("cold", 50, 10), lastUsedAt: recentDate(100) }, // too old
      { ...makeArm("weak", 2, 50), lastUsedAt: recentDate(10) },   // lower too low
      { ...makeArm("fresh", 30, 5), lastUsedAt: recentDate(1) },   // lower ≈ 0.77
    ];
    const result = hotStreakCandidates(arms, { minLower: 0.05, freshnessHours: 72 });
    expect(result).toContain("hot");
    expect(result).toContain("fresh");
    expect(result).not.toContain("cold");  // outside freshness window
    expect(result).not.toContain("weak");  // lower bound too low
  });

  it("respects the freshness window", () => {
    const arms = [
      { ...makeArm("stale", 50, 10), lastUsedAt: recentDate(100) },
    ];
    const result = hotStreakCandidates(arms, { minLower: 0.05, freshnessHours: 72 });
    expect(result).toHaveLength(0);
  });

  it("excludes arms with null lastUsedAt", () => {
    const arms = [
      { ...makeArm("never_used", 50, 10), lastUsedAt: null },
    ];
    const result = hotStreakCandidates(arms, { minLower: 0.05, freshnessHours: 72 });
    expect(result).toHaveLength(0);
  });

  it("respects minLower threshold", () => {
    const arms = [
      { ...makeArm("weak", 2, 50), lastUsedAt: recentDate(1) }, // lower ≈ 0.005
    ];
    const result = hotStreakCandidates(arms, { minLower: 0.05, freshnessHours: 72 });
    expect(result).toHaveLength(0);
  });
});
