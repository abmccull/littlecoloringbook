import type { AdMetricsSummary } from "@littlecolorbook/db";

export type MetricsSummary = AdMetricsSummary;

export type OutcomeDelta = {
  delta: Record<string, number>;
  direction: "improved" | "worsened" | "flat";
};

// ─── Outcome delta computation ────────────────────────────────────────────────
// Primary signal: ROAS change.
// Tiebreaker (when ROAS is flat or unavailable): CPA direction + CTR direction.
// "flat" = all primary/tiebreaker signals within the noise threshold (5%).

const FLAT_THRESHOLD = 0.05; // 5% relative change counts as flat

function relativeDelta(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  if (before === 0) return null;
  return (after - before) / before;
}

export function computeOutcomeDelta(
  baselineMetrics: MetricsSummary,
  currentMetrics: MetricsSummary,
): OutcomeDelta {
  const roasBefore = baselineMetrics.roas;
  const roasAfter = currentMetrics.roas;
  const cpaBefore = baselineMetrics.avgCpaCents;
  const cpaAfter = currentMetrics.avgCpaCents;
  const ctrBefore = baselineMetrics.avgCtr;
  const ctrAfter = currentMetrics.avgCtr;

  const delta: Record<string, number> = {};

  // Absolute deltas
  delta.spend_cents = currentMetrics.totalSpendCents - baselineMetrics.totalSpendCents;
  delta.purchases = currentMetrics.totalPurchases - baselineMetrics.totalPurchases;
  delta.impressions = currentMetrics.totalImpressions - baselineMetrics.totalImpressions;

  if (roasBefore !== null && roasAfter !== null) {
    delta.roas = roasAfter - roasBefore;
    delta.roas_relative_pct = ((roasAfter - roasBefore) / Math.max(roasBefore, 0.0001)) * 100;
  }
  if (cpaBefore !== null && cpaAfter !== null) {
    delta.cpa_cents = cpaAfter - cpaBefore;
    delta.cpa_relative_pct = ((cpaAfter - cpaBefore) / Math.max(cpaBefore, 0.0001)) * 100;
  }
  if (ctrBefore !== null && ctrAfter !== null) {
    delta.ctr = ctrAfter - ctrBefore;
    delta.ctr_relative_pct = ((ctrAfter - ctrBefore) / Math.max(ctrBefore, 0.0001)) * 100;
  }

  // ─── Direction heuristic ──────────────────────────────────────────────────
  // Primary: ROAS change.
  const roasRelative = relativeDelta(roasBefore, roasAfter);
  if (roasRelative !== null && Math.abs(roasRelative) > FLAT_THRESHOLD) {
    return {
      delta,
      direction: roasRelative > 0 ? "improved" : "worsened",
    };
  }

  // Tiebreaker: CPA + CTR
  let improvedSignals = 0;
  let worsenedSignals = 0;

  const cpaRelative = relativeDelta(cpaBefore, cpaAfter);
  if (cpaRelative !== null && Math.abs(cpaRelative) > FLAT_THRESHOLD) {
    // Lower CPA = improved
    if (cpaRelative < 0) improvedSignals++;
    else worsenedSignals++;
  }

  const ctrRelative = relativeDelta(ctrBefore, ctrAfter);
  if (ctrRelative !== null && Math.abs(ctrRelative) > FLAT_THRESHOLD) {
    // Higher CTR = improved
    if (ctrRelative > 0) improvedSignals++;
    else worsenedSignals++;
  }

  if (improvedSignals > worsenedSignals) return { delta, direction: "improved" };
  if (worsenedSignals > improvedSignals) return { delta, direction: "worsened" };
  return { delta, direction: "flat" };
}
