import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  evaluateKillRules,
  evaluateWinnerRules,
  evaluateFatigue,
  parseRulesFromTaxonomy,
} from "../rules";
import type { MetricsSnapshot, KillRules, WinnerRules } from "../rules";

const TAXONOMY_PATH = resolve(process.cwd(), "../../campaign-taxonomy.yaml");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const defaultKillRules: KillRules = {
  spendFloorCents: 1000,
  noCartAfterSpendCents: 1500,
  maxCpaMultiple: 2.5,
  targetCpaCents: 3000,
  minHookRate: 0.02,
  hookRateMinImpressions: 1000,
  maxFrequency: null,
};

const defaultWinnerRules: WinnerRules = {
  spendFloorCents: 2500,
  minPurchases: 3,
  maxCpaCents: 3000,
  minRoas: null,
  minCtr: null,
};

function makeSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    spendCents: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    purchases: 0,
    revenueCents: 0,
    addsToCart: 0,
    frequency: null,
    ctr: null,
    cpm_cents: null,
    cpa_cents: null,
    roas: null,
    hookRate: null,
    days: 7,
    ...overrides,
  };
}

// ─── evaluateKillRules ────────────────────────────────────────────────────────

describe("evaluateKillRules", () => {
  it("does not trigger below spend floor", () => {
    const snap = makeSnapshot({ spendCents: 900, addsToCart: 0 });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(false);
  });

  it("triggers no_cart_after_spend_floor when spend >= threshold and carts=0", () => {
    const snap = makeSnapshot({ spendCents: 1500, addsToCart: 0 });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("no_cart_after_spend_floor");
  });

  it("does not trigger no_cart rule when there is at least 1 cart", () => {
    const snap = makeSnapshot({ spendCents: 2000, addsToCart: 1 });
    const result = evaluateKillRules(snap, defaultKillRules);
    // May still fail on CPA, but not on the cart rule specifically
    expect(result.reason).not.toBe("no_cart_after_spend_floor");
  });

  it("triggers cpa_above_target_multiple when CPA is over the multiplier", () => {
    // targetCpaCents=3000, maxCpaMultiple=2.5 → kill above 7500
    const snap = makeSnapshot({ spendCents: 5000, addsToCart: 1, cpa_cents: 8000 });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("cpa_above_target_multiple");
    expect(result.metric).toBe(8000);
  });

  it("does not trigger CPA rule when CPA is within allowed multiple", () => {
    const snap = makeSnapshot({ spendCents: 5000, addsToCart: 2, cpa_cents: 6000 });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(false);
  });

  it("triggers hook_rate_below_floor when impressions sufficient and rate too low", () => {
    const snap = makeSnapshot({
      spendCents: 2000,
      addsToCart: 1,
      impressions: 2000,
      hookRate: 0.01, // below 0.02 floor
    });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("hook_rate_below_floor");
  });

  it("does not trigger hook_rate rule when impressions below minimum threshold", () => {
    const snap = makeSnapshot({
      spendCents: 2000,
      addsToCart: 1,
      impressions: 500, // below hookRateMinImpressions
      hookRate: 0.005,
    });
    const result = evaluateKillRules(snap, defaultKillRules);
    expect(result.triggered).toBe(false);
  });

  it("handles null metrics gracefully — no throw", () => {
    const snap = makeSnapshot({
      spendCents: 5000,
      addsToCart: 0,
      cpa_cents: null,
      hookRate: null,
      frequency: null,
    });
    expect(() => evaluateKillRules(snap, defaultKillRules)).not.toThrow();
  });

  it("triggers frequency kill when maxFrequency is set and exceeded", () => {
    const rules: KillRules = { ...defaultKillRules, maxFrequency: 5 };
    const snap = makeSnapshot({ spendCents: 2000, addsToCart: 1, frequency: 6 });
    const result = evaluateKillRules(snap, rules);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("frequency_above_max");
  });
});

// ─── evaluateWinnerRules ──────────────────────────────────────────────────────

describe("evaluateWinnerRules", () => {
  it("does not trigger below spend floor", () => {
    const snap = makeSnapshot({ spendCents: 2000, purchases: 5, cpa_cents: 2000 });
    const result = evaluateWinnerRules(snap, defaultWinnerRules);
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when purchases below minimum", () => {
    const snap = makeSnapshot({ spendCents: 3000, purchases: 2, cpa_cents: 2000 });
    const result = evaluateWinnerRules(snap, defaultWinnerRules);
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when CPA is above max", () => {
    const snap = makeSnapshot({ spendCents: 3000, purchases: 3, cpa_cents: 4000 });
    const result = evaluateWinnerRules(snap, defaultWinnerRules);
    expect(result.triggered).toBe(false);
  });

  it("triggers when all win conditions are met", () => {
    const snap = makeSnapshot({
      spendCents: 3000,
      purchases: 4,
      cpa_cents: 2500,
    });
    const result = evaluateWinnerRules(snap, defaultWinnerRules);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("purchase_cac_below_target");
    expect(result.metric).toBe(2500);
  });

  it("triggers at exact spend floor with sufficient purchases + CPA", () => {
    const snap = makeSnapshot({ spendCents: 2500, purchases: 3, cpa_cents: 3000 });
    const result = evaluateWinnerRules(snap, defaultWinnerRules);
    expect(result.triggered).toBe(true);
  });

  it("respects optional minRoas gate when configured", () => {
    const rules: WinnerRules = { ...defaultWinnerRules, minRoas: 2.0 };
    const snap = makeSnapshot({ spendCents: 3000, purchases: 5, cpa_cents: 2000, roas: 1.5 });
    const result = evaluateWinnerRules(snap, rules);
    expect(result.triggered).toBe(false);
  });

  it("passes minRoas gate when ROAS meets threshold", () => {
    const rules: WinnerRules = { ...defaultWinnerRules, minRoas: 2.0 };
    const snap = makeSnapshot({ spendCents: 3000, purchases: 5, cpa_cents: 2000, roas: 3.0 });
    const result = evaluateWinnerRules(snap, rules);
    expect(result.triggered).toBe(true);
  });
});

// ─── evaluateFatigue ──────────────────────────────────────────────────────────

describe("evaluateFatigue", () => {
  it("does not trigger on insufficient history (< 8 days)", () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-0${i + 1}`,
      ctr: 0.05,
      frequency: 4,
    }));
    const result = evaluateFatigue(history);
    expect(result.triggered).toBe(false);
  });

  it("detects fatigue when CTR declines >= 15% and frequency >= 3", () => {
    // Baseline 7 days at CTR=0.05, then 3 recent days at CTR=0.03 (40% decline), freq=4
    const baseline = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      ctr: 0.05,
      frequency: 2,
    }));
    const recent = Array.from({ length: 3 }, (_, i) => ({
      date: `2026-05-${String(i + 8).padStart(2, "0")}`,
      ctr: 0.03,
      frequency: 4,
    }));
    const history = [...baseline, ...recent];
    const result = evaluateFatigue(history, { ctrDeclinePct: 15, frequencyFloor: 3 });
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("ctr_decline_and_frequency_above_floor");
    expect(result.ctrDeclinePct).toBeGreaterThanOrEqual(15);
  });

  it("does not trigger when CTR decline is below threshold", () => {
    // Only a 5% decline
    const baseline = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      ctr: 0.05,
      frequency: 2,
    }));
    const recent = [{ date: "2026-05-08", ctr: 0.0478, frequency: 4 }];
    const history = [...baseline, ...recent];
    const result = evaluateFatigue(history, { ctrDeclinePct: 15, frequencyFloor: 3 });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when CTR declines but frequency is below floor", () => {
    const baseline = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      ctr: 0.05,
      frequency: 1,
    }));
    const recent = [{ date: "2026-05-08", ctr: 0.02, frequency: 1.5 }];
    const history = [...baseline, ...recent];
    const result = evaluateFatigue(history, { ctrDeclinePct: 15, frequencyFloor: 3 });
    expect(result.triggered).toBe(false);
  });

  it("handles null CTR values gracefully without throwing", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      ctr: null,
      frequency: 3,
    }));
    expect(() => evaluateFatigue(history)).not.toThrow();
    const result = evaluateFatigue(history);
    expect(result.triggered).toBe(false);
  });

  it("returns ctrDeclinePct even when not triggered", () => {
    const baseline = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, "0")}`,
      ctr: 0.05,
      frequency: 2,
    }));
    const recent = [{ date: "2026-05-08", ctr: 0.048, frequency: 2 }];
    const result = evaluateFatigue([...baseline, ...recent]);
    expect(result.ctrDeclinePct).toBeDefined();
    expect(typeof result.ctrDeclinePct).toBe("number");
  });
});

// ─── parseRulesFromTaxonomy ───────────────────────────────────────────────────

describe("parseRulesFromTaxonomy", () => {
  it("loads campaign-taxonomy.yaml without throwing", () => {
    expect(() => parseRulesFromTaxonomy(TAXONOMY_PATH)).not.toThrow();
  });

  it("returns killRules and winnerRules objects with numeric thresholds", () => {
    const { killRules, winnerRules } = parseRulesFromTaxonomy(TAXONOMY_PATH);

    expect(typeof killRules.spendFloorCents).toBe("number");
    expect(typeof killRules.noCartAfterSpendCents).toBe("number");
    expect(typeof killRules.maxCpaMultiple).toBe("number");
    expect(typeof killRules.targetCpaCents).toBe("number");
    expect(typeof killRules.hookRateMinImpressions).toBe("number");

    expect(typeof winnerRules.spendFloorCents).toBe("number");
    expect(typeof winnerRules.minPurchases).toBe("number");
    expect(typeof winnerRules.maxCpaCents).toBe("number");
  });

  it("reads cold_paid_cac_target from kpi_targets and converts to cents", () => {
    const { killRules, winnerRules } = parseRulesFromTaxonomy(TAXONOMY_PATH);
    // campaign-taxonomy.yaml has cold_paid_cac_target: 30
    expect(killRules.targetCpaCents).toBe(3000);
    expect(winnerRules.maxCpaCents).toBe(3000);
  });
});
