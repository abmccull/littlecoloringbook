import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  isDatabaseConfigured,
  findBaselinesNeedingObservation,
  getEntityMetricsSummary,
  insertAgentJournalEntry,
} from "@littlecolorbook/db";
import { computeOutcomeDelta } from "@littlecolorbook/ads";
import { generateId } from "@littlecolorbook/shared";

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDeltaNote(
  windowLabel: "24h" | "72h",
  direction: "improved" | "worsened" | "flat",
  delta: Record<string, number>,
): string {
  const parts: string[] = [];

  if (delta.cpa_relative_pct !== undefined) {
    const sign = delta.cpa_relative_pct < 0 ? "" : "+";
    parts.push(`CPA ${sign}${delta.cpa_relative_pct.toFixed(0)}%`);
  }
  if (delta.roas !== undefined) {
    const sign = delta.roas >= 0 ? "+" : "";
    parts.push(`ROAS ${sign}${delta.roas.toFixed(2)}`);
  }

  const metrics = parts.length > 0 ? ` — ${parts.join(", ")}` : "";
  return `${windowLabel} outcome: ${direction}${metrics}`;
}

type ReflectionSummary = {
  processed: number;
  observations_24h: number;
  observations_72h: number;
  skipped_no_metrics: number;
  errors: string[];
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const summary: ReflectionSummary = {
    processed: 0,
    observations_24h: 0,
    observations_72h: 0,
    skipped_no_metrics: 0,
    errors: [],
  };

  const baselines = await findBaselinesNeedingObservation(50);

  for (const baseline of baselines) {
    try {
      const entityType = baseline.targetEntityType as "ad" | "adset" | "campaign";

      const currentMetrics = await getEntityMetricsSummary(entityType, baseline.targetMetaId, {
        dateFrom: nDaysAgo(7),
        dateTo: todayString(),
      });

      // Skip gracefully if the target has no metric rows yet (new ad, data not collected).
      if (
        currentMetrics.totalImpressions === 0 &&
        currentMetrics.totalSpendCents === 0 &&
        currentMetrics.totalPurchases === 0
      ) {
        summary.skipped_no_metrics++;
        continue;
      }

      const baselineMetrics = baseline.metricsJson as Parameters<typeof computeOutcomeDelta>[0];
      const { delta, direction } = computeOutcomeDelta(baselineMetrics, currentMetrics);

      const windowLabel = baseline.observationKind === "outcome_observed_24h" ? "24h" : "72h";
      const note = formatDeltaNote(windowLabel, direction, delta);

      await insertAgentJournalEntry({
        id: generateId("jrn"),
        kind: baseline.observationKind,
        relatedProposalId: baseline.proposalId,
        targetEntityType: baseline.targetEntityType,
        targetMetaId: baseline.targetMetaId,
        note,
        metricsSnapshotJson: currentMetrics as unknown as Record<string, unknown>,
        deltaFromBaselineJson: delta as Record<string, unknown>,
        createdBy: "cron:agent-outcome-reflection",
      });

      summary.processed++;
      if (baseline.observationKind === "outcome_observed_24h") {
        summary.observations_24h++;
      } else {
        summary.observations_72h++;
      }
    } catch (err) {
      summary.errors.push(
        `baseline ${baseline.id} (${baseline.observationKind}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return NextResponse.json(summary, { status: 200 });
}
