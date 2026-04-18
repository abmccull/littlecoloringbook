import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "../../../../lib/agent-auth";
import {
  isDatabaseConfigured,
  listNonDeletedAds,
  listNonDeletedCampaigns,
  getAdMetricsSummary,
  getTopPerformingAds,
  listAgentProposals,
  listAgentJournal,
  listAdDailyMetrics,
} from "@littlecolorbook/db";
import {
  evaluateKillRules,
  evaluateWinnerRules,
  evaluateFatigue,
} from "@littlecolorbook/ads";
import type { KillRules, WinnerRules } from "@littlecolorbook/ads";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MAX_DAILY_BUDGET_USD = parseFloat(process.env.MAX_DAILY_BUDGET_USD ?? "100");

const DEFAULT_KILL_RULES: KillRules = {
  spendFloorCents: 1000,
  noCartAfterSpendCents: 1500,
  maxCpaMultiple: 2.5,
  targetCpaCents: 3000,
  minHookRate: 0.02,
  hookRateMinImpressions: 1000,
  maxFrequency: null,
};

const DEFAULT_WINNER_RULES: WinnerRules = {
  spendFloorCents: 2500,
  minPurchases: 3,
  maxCpaCents: 3000,
  minRoas: null,
  minCtr: null,
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeAgentRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured." } },
      { status: 503 },
    );
  }

  const today = todayString();
  const sevenDaysAgo = nDaysAgo(7);

  // ── Budget utilization from today's ad_daily_metrics ────────────────────────
  const todayMetrics = await listAdDailyMetrics({ dateFrom: today, dateTo: today, limit: 500 });
  const spendTodayCents = todayMetrics.reduce((sum, r) => sum + r.spendCents, 0);
  const spendTodayUsd = spendTodayCents / 100;
  const pctUsed = MAX_DAILY_BUDGET_USD > 0 ? Math.min(1, spendTodayUsd / MAX_DAILY_BUDGET_USD) : 0;

  // ── Campaigns ────────────────────────────────────────────────────────────────
  const dbCampaigns = await listNonDeletedCampaigns();
  const activeCampaigns = await Promise.all(
    dbCampaigns.map(async (c) => {
      const metrics = await getAdMetricsSummary(c.metaId, { dateFrom: sevenDaysAgo, dateTo: today });
      return {
        meta_id: c.metaId,
        name: c.name,
        objective: c.objective,
        status: c.status,
        last_synced_at: c.lastSyncedAt?.toISOString() ?? null,
        metrics_7d: {
          spend_usd: metrics.totalSpendCents / 100,
          impressions: metrics.totalImpressions,
          purchases: metrics.totalPurchases,
          revenue_usd: 0,
          roas: metrics.roas,
          ctr: metrics.avgCtr,
        },
      };
    }),
  );

  // ── Ads with flags ────────────────────────────────────────────────────────────
  const dbAds = await listNonDeletedAds();
  const recentAds = dbAds.slice(0, 50);

  const adsWithFlags = await Promise.all(
    recentAds.map(async (ad) => {
      const metrics7d = await getAdMetricsSummary(ad.metaId, { dateFrom: sevenDaysAgo, dateTo: today });

      // Build a metrics snapshot for rules engine
      const snapshot = {
        spendCents: metrics7d.totalSpendCents,
        impressions: metrics7d.totalImpressions,
        clicks: 0,
        linkClicks: 0,
        purchases: metrics7d.totalPurchases,
        revenueCents: 0,
        addsToCart: 0,
        frequency: null,
        ctr: metrics7d.avgCtr,
        cpm_cents: metrics7d.avgCpmCents,
        cpa_cents: metrics7d.avgCpaCents,
        roas: metrics7d.roas,
        hookRate: null,
        days: 7,
      };

      const kill = evaluateKillRules(snapshot, DEFAULT_KILL_RULES);
      const winner = evaluateWinnerRules(snapshot, DEFAULT_WINNER_RULES);

      // Fatigue needs history rows
      const historyRows = await listAdDailyMetrics({
        entityMetaIds: [ad.metaId],
        dateFrom: nDaysAgo(14),
        dateTo: today,
      });
      const historyForFatigue = historyRows.map((r) => ({
        date: r.date,
        ctr: r.ctr !== null ? parseFloat(r.ctr as unknown as string) : null,
        frequency: r.frequency !== null ? parseFloat(r.frequency as unknown as string) : null,
      }));
      const fatigue = evaluateFatigue(historyForFatigue);

      return {
        meta_id: ad.metaId,
        name: ad.name,
        status: ad.status,
        adset_meta_id: null as string | null, // adSetId is our internal id, not meta_id — callers use meta sync for this
        campaign_meta_id: null as string | null,
        metrics_7d: {
          spend_usd: metrics7d.totalSpendCents / 100,
          impressions: metrics7d.totalImpressions,
          purchases: metrics7d.totalPurchases,
          roas: metrics7d.roas,
          ctr: metrics7d.avgCtr,
          cpa_usd: metrics7d.avgCpaCents !== null ? metrics7d.avgCpaCents / 100 : null,
        },
        flags: {
          kill: { triggered: kill.triggered, reason: kill.reason ?? null },
          winner: { triggered: winner.triggered, reason: winner.reason ?? null },
          fatigue: {
            triggered: fatigue.triggered,
            reason: fatigue.reason ?? null,
            ctr_decline_pct: fatigue.ctrDeclinePct ?? null,
          },
        },
      };
    }),
  );

  // ── Top/bottom performers ────────────────────────────────────────────────────
  const topPerformers = await getTopPerformingAds({
    metric: "roas",
    direction: "desc",
    dateFrom: sevenDaysAgo,
    dateTo: today,
    limit: 5,
  });
  const bottomPerformers = await getTopPerformingAds({
    metric: "cpa_cents",
    direction: "desc",
    dateFrom: sevenDaysAgo,
    dateTo: today,
    limit: 5,
  });

  // ── Recent proposals + journal ───────────────────────────────────────────────
  const recentProposals = await listAgentProposals({ limit: 10 });
  const recentJournal = await listAgentJournal({ limit: 10 });

  const payload = {
    timestamp: new Date().toISOString(),
    today_date: today,
    budget_utilization: {
      max_daily_budget_usd: MAX_DAILY_BUDGET_USD,
      spend_today_usd_approx: Math.round(spendTodayUsd * 100) / 100,
      pct_used: Math.round(pctUsed * 1000) / 1000,
    },
    account: {
      paid_ads_enabled: Boolean(process.env.META_AD_ACCOUNT_ID),
    },
    active_campaigns: activeCampaigns,
    ads: adsWithFlags,
    top_performers: topPerformers.map((p) => ({
      entity_meta_id: p.entityMetaId,
      avg_roas: p.avgMetric,
      total_spend_usd: p.totalSpendCents / 100,
      total_purchases: p.totalPurchases,
    })),
    bottom_performers: bottomPerformers.map((p) => ({
      entity_meta_id: p.entityMetaId,
      avg_cpa_usd: p.avgMetric !== null ? p.avgMetric / 100 : null,
      total_spend_usd: p.totalSpendCents / 100,
      total_purchases: p.totalPurchases,
    })),
    recent_proposals: recentProposals.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      rationale: p.rationale,
      created_at: p.createdAt.toISOString(),
      target_meta_id: p.targetMetaId,
    })),
    recent_journal: recentJournal.map((j) => ({
      id: j.id,
      kind: j.kind,
      note: j.note,
      related_proposal_id: j.relatedProposalId,
      created_at: j.createdAt.toISOString(),
    })),
    capi_emq: null,
  };

  return NextResponse.json(payload, { status: 200 });
}
