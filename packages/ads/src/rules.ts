// ─── Field-name mapping note ──────────────────────────────────────────────────
// campaign-taxonomy.yaml's kill_rules and winner_rules are arrays of string
// identifiers (e.g. "bottom_quartile_hook_rate_after_sufficient_views"), not
// structured objects with numeric thresholds.  This module maps those string
// keys onto the numeric threshold structs below.  All thresholds here match the
// plan spec (§2 Phase 4 "winner/loser detector").  Phase 4 may evolve the YAML
// to carry explicit thresholds; until then this file owns the numbers.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";

// ─── Shared snapshot type ─────────────────────────────────────────────────────

export type MetricsSnapshot = {
  spendCents: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  purchases: number;
  revenueCents: number;
  addsToCart: number;
  frequency: number | null;
  ctr: number | null;
  cpm_cents: number | null;
  cpa_cents: number | null;
  roas: number | null;
  hookRate: number | null;
  days: number;
};

export type RuleDecision = {
  triggered: boolean;
  reason?: string;
  metric?: number;
};

// ─── Kill rules ───────────────────────────────────────────────────────────────

export type KillRules = {
  // Minimum spend in cents before any kill rule fires.
  spendFloorCents: number;
  // Kill if adds_to_cart === 0 after spending this many cents.
  noCartAfterSpendCents: number;
  // Kill if CPL (cpa_cents) is above this multiple of the target CPL.
  maxCpaMultiple: number;
  // CPL target in cents (from kpi_targets.cold_paid_cac_target * 100).
  targetCpaCents: number;
  // Kill if hook_rate below this threshold after minimum impressions.
  minHookRate: number | null;
  // Minimum impressions before hook_rate kill applies.
  hookRateMinImpressions: number;
  // Kill if frequency exceeds this.
  maxFrequency: number | null;
};

const DEFAULT_KILL_RULES: KillRules = {
  spendFloorCents: 1000,         // $10 minimum before evaluating
  noCartAfterSpendCents: 1500,   // $15 spend with 0 carts → kill
  maxCpaMultiple: 2.5,           // CPA > 2.5× target → kill
  targetCpaCents: 3000,          // $30 blended_cac_target from taxonomy
  minHookRate: 0.02,             // below 2% hook rate after 1k impressions
  hookRateMinImpressions: 1000,
  maxFrequency: null,            // frequency kill not yet active
};

// ─── Winner rules ─────────────────────────────────────────────────────────────

export type WinnerRules = {
  // Minimum spend in cents before a win can be confirmed.
  spendFloorCents: number;
  // Minimum number of purchases required.
  minPurchases: number;
  // Maximum CPA in cents (must be at or below this).
  maxCpaCents: number;
  // Minimum ROAS (optional).
  minRoas: number | null;
  // CTR must be above this threshold (optional).
  minCtr: number | null;
};

const DEFAULT_WINNER_RULES: WinnerRules = {
  spendFloorCents: 2500,   // $25 minimum spend
  minPurchases: 3,
  maxCpaCents: 3000,       // CPA ≤ $30 (cold_paid_cac_target)
  minRoas: null,
  minCtr: null,
};

// ─── Fatigue ──────────────────────────────────────────────────────────────────

export type FatigueOptions = {
  ctrDeclinePct?: number;
  frequencyFloor?: number;
};

// ─── Evaluate kill rules ──────────────────────────────────────────────────────

export function evaluateKillRules(
  snapshot: MetricsSnapshot,
  killRules: KillRules,
): RuleDecision {
  if (snapshot.spendCents < killRules.spendFloorCents) {
    return { triggered: false };
  }

  // No add-to-cart after spend threshold
  if (snapshot.spendCents >= killRules.noCartAfterSpendCents && snapshot.addsToCart === 0) {
    return {
      triggered: true,
      reason: "no_cart_after_spend_floor",
      metric: snapshot.spendCents,
    };
  }

  // CPA materially above target
  if (
    snapshot.cpa_cents != null &&
    snapshot.cpa_cents > killRules.targetCpaCents * killRules.maxCpaMultiple
  ) {
    return {
      triggered: true,
      reason: "cpa_above_target_multiple",
      metric: snapshot.cpa_cents,
    };
  }

  // Hook rate too low after sufficient impressions
  if (
    killRules.minHookRate != null &&
    snapshot.hookRate != null &&
    snapshot.impressions >= killRules.hookRateMinImpressions &&
    snapshot.hookRate < killRules.minHookRate
  ) {
    return {
      triggered: true,
      reason: "hook_rate_below_floor",
      metric: snapshot.hookRate,
    };
  }

  // Frequency too high
  if (
    killRules.maxFrequency != null &&
    snapshot.frequency != null &&
    snapshot.frequency > killRules.maxFrequency
  ) {
    return {
      triggered: true,
      reason: "frequency_above_max",
      metric: snapshot.frequency,
    };
  }

  return { triggered: false };
}

// ─── Evaluate winner rules ────────────────────────────────────────────────────

export function evaluateWinnerRules(
  snapshot: MetricsSnapshot,
  winnerRules: WinnerRules,
): RuleDecision {
  if (snapshot.spendCents < winnerRules.spendFloorCents) {
    return { triggered: false };
  }

  if (snapshot.purchases < winnerRules.minPurchases) {
    return { triggered: false };
  }

  if (snapshot.cpa_cents == null || snapshot.cpa_cents > winnerRules.maxCpaCents) {
    return { triggered: false };
  }

  if (winnerRules.minRoas != null && (snapshot.roas == null || snapshot.roas < winnerRules.minRoas)) {
    return { triggered: false };
  }

  if (winnerRules.minCtr != null && (snapshot.ctr == null || snapshot.ctr < winnerRules.minCtr)) {
    return { triggered: false };
  }

  return {
    triggered: true,
    reason: "purchase_cac_below_target",
    metric: snapshot.cpa_cents,
  };
}

// ─── Evaluate fatigue ─────────────────────────────────────────────────────────

export function evaluateFatigue(
  history: Array<{ date: string; ctr: number | null; frequency: number | null }>,
  { ctrDeclinePct = 15, frequencyFloor = 3 }: FatigueOptions = {},
): RuleDecision & { ctrDeclinePct?: number } {
  // Need at least 8 days of data (7-day baseline + at least 1 comparison day).
  if (history.length < 8) {
    return { triggered: false };
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  // Baseline = average CTR over first 7 days of sorted history.
  const baselineDays = sorted.slice(0, 7);
  const baselineCtrValues = baselineDays.map((d) => d.ctr).filter((v): v is number => v != null);
  if (baselineCtrValues.length === 0) {
    return { triggered: false };
  }
  const baselineCtr = baselineCtrValues.reduce((a, b) => a + b, 0) / baselineCtrValues.length;

  // Recent = last day(s) beyond the baseline window.
  const recentDays = sorted.slice(7);
  const recentCtrValues = recentDays.map((d) => d.ctr).filter((v): v is number => v != null);
  if (recentCtrValues.length === 0) {
    return { triggered: false };
  }
  const recentCtr = recentCtrValues.reduce((a, b) => a + b, 0) / recentCtrValues.length;

  if (baselineCtr === 0) {
    return { triggered: false };
  }

  const declinePct = ((baselineCtr - recentCtr) / baselineCtr) * 100;

  // Check frequency on the most recent data point.
  const latestFrequency = sorted[sorted.length - 1]?.frequency ?? null;
  const freqConditionMet = latestFrequency != null && latestFrequency >= frequencyFloor;

  if (declinePct >= ctrDeclinePct && freqConditionMet) {
    return {
      triggered: true,
      reason: "ctr_decline_and_frequency_above_floor",
      metric: recentCtr,
      ctrDeclinePct: parseFloat(declinePct.toFixed(2)),
    };
  }

  return { triggered: false, ctrDeclinePct: parseFloat(declinePct.toFixed(2)) };
}

// ─── Parse rules from taxonomy YAML ──────────────────────────────────────────
// The YAML kill_rules/winner_rules arrays contain string identifiers.
// We map them onto the numeric threshold structs, returning defaults enhanced
// by any numeric overrides present (none in current YAML — the identifiers are
// semantic labels, not threshold carriers).

type TaxonomyYaml = {
  kill_rules?: string[];
  winner_rules?: { paid?: string[]; organic?: string[] } | string[];
  kpi_targets?: {
    cold_paid_cac_target?: number;
    free_sample_cpl_target?: number;
  };
};

export function parseRulesFromTaxonomy(yamlPath: string): {
  killRules: KillRules;
  winnerRules: WinnerRules;
} {
  const raw = readFileSync(yamlPath, "utf8");
  const taxonomy = loadYaml(raw) as TaxonomyYaml;

  const coldCac = taxonomy.kpi_targets?.cold_paid_cac_target;
  const targetCpaCents = coldCac != null ? Math.round(coldCac * 100) : DEFAULT_KILL_RULES.targetCpaCents;

  const killRules: KillRules = {
    ...DEFAULT_KILL_RULES,
    targetCpaCents,
  };

  const winnerRules: WinnerRules = {
    ...DEFAULT_WINNER_RULES,
    maxCpaCents: targetCpaCents,
  };

  return { killRules, winnerRules };
}
