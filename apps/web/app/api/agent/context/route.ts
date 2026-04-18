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
  getElementPerformance,
  listTopPerformingTagCombos,
  listCopyElements,
} from "@littlecolorbook/db";
import {
  evaluateKillRules,
  evaluateWinnerRules,
  evaluateFatigue,
  buildBanditArmsFromPerformance,
  confidenceInterval95,
  retirementCandidates,
  hotStreakCandidates,
} from "@littlecolorbook/ads";
import type { KillRules, WinnerRules, BanditArm } from "@littlecolorbook/ads";
import type { SamplingMode } from "@littlecolorbook/ads";

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

const DEFAULT_SAMPLING_MODE: SamplingMode =
  (process.env.DEFAULT_BRIEF_SAMPLING_MODE as SamplingMode | undefined) ?? "uniform";

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

// ─── Creative intelligence builder ────────────────────────────────────────────

type ElementSummary = {
  id: string;
  text: string;
  avgRoas: number;
  avgCtr: number;
  avgCpaCents: number;
  adCount: number;
  confidenceLowerBound: number;
  lastUsedAt: string | null;
};

type RetirementSummary = {
  id: string;
  text: string;
  spendCents: number;
  upperBound: number;
  reason: string;
};

type HotStreakSummary = {
  id: string;
  kind: string;
  text: string;
  lastUsedAt: string | null;
  lowerBound: number;
};

type TagComboSummary = {
  combo: string;
  avgRoas: number | null;
  avgCtr: number | null;
  adCount: number;
};

type TagComboLoserSummary = {
  combo: string;
  avgCpaCents: number | null;
  adCount: number;
  reason: string;
};

type CreativeIntelligence = {
  top_elements: {
    hooks: ElementSummary[];
    bodies: ElementSummary[];
    ctas: ElementSummary[];
    visual_styles: ElementSummary[];
  };
  retirement_candidates: {
    hooks: RetirementSummary[];
    bodies: RetirementSummary[];
    ctas: RetirementSummary[];
    visual_styles: RetirementSummary[];
  };
  tag_combo_winners: TagComboSummary[];
  tag_combo_losers: TagComboLoserSummary[];
  hot_streak: HotStreakSummary[];
  sampling_mode: SamplingMode;
  note: string;
};

async function buildCreativeIntelligence(
  dateFrom: string,
  dateTo: string,
): Promise<CreativeIntelligence> {
  const KINDS = ["hook", "body", "cta", "visual_style"] as const;

  // ── 1. Fetch all copy elements (for text lookup) ─────────────────────────────
  const allElements = await listCopyElements({ limit: 500 });
  const elementTextMap = new Map<string, string>(allElements.map((e) => [e.id, e.text]));
  const elementLastUsedMap = new Map<string, Date | null>(
    allElements.map((e) => [e.id, e.lastUsedAt ?? null]),
  );

  // ── 2. Fetch performance per kind ────────────────────────────────────────────
  const perfByKind = Object.fromEntries(
    await Promise.all(
      KINDS.map(async (kind) => {
        const rows = await getElementPerformance({ kind, dateFrom, dateTo });
        return [kind, rows] as const;
      }),
    ),
  ) as Record<(typeof KINDS)[number], Awaited<ReturnType<typeof getElementPerformance>>>;

  // ── 3. Build bandit arms per kind ────────────────────────────────────────────
  function buildArmsForKind(kind: (typeof KINDS)[number]): (BanditArm & { spendCents: number; lastUsedAt: Date | null })[] {
    return perfByKind[kind].map((row) => {
      const baseArm = buildBanditArmsFromPerformance(
        [{ id: row.elementId, purchases: row.totalPurchases, clicks: row.adCount * 100, lastUsedAt: elementLastUsedMap.get(row.elementId) ?? null }],
      )[0]!;
      return {
        ...baseArm,
        spendCents: row.totalSpendCents,
        lastUsedAt: elementLastUsedMap.get(row.elementId) ?? null,
      };
    });
  }

  const armsByKind = Object.fromEntries(
    KINDS.map((k) => [k, buildArmsForKind(k)]),
  ) as Record<(typeof KINDS)[number], (BanditArm & { spendCents: number; lastUsedAt: Date | null })[]>;

  // ── 4. Top elements — rank by confidence lower bound (top 10 each) ───────────
  function topElements(kind: (typeof KINDS)[number]): ElementSummary[] {
    const rows = perfByKind[kind];
    return rows
      .map((row) => ({
        row,
        clb: row.confidenceLowerBound,
      }))
      .sort((a, b) => b.clb - a.clb)
      .slice(0, 10)
      .map(({ row }) => ({
        id: row.elementId,
        text: elementTextMap.get(row.elementId) ?? row.elementId,
        avgRoas: row.avgRoas,
        avgCtr: row.avgCtr,
        avgCpaCents: row.avgCpaCents,
        adCount: row.adCount,
        confidenceLowerBound: row.confidenceLowerBound,
        lastUsedAt: elementLastUsedMap.get(row.elementId)?.toISOString() ?? null,
      }));
  }

  // ── 5. Retirement candidates per kind ────────────────────────────────────────
  function retirementForKind(kind: (typeof KINDS)[number]): RetirementSummary[] {
    const arms = armsByKind[kind];
    const retireIds = retirementCandidates(arms, { minSpendCents: 5000, maxUpperBound: 0.02 });
    return retireIds.map((id) => {
      const arm = arms.find((a) => a.id === id)!;
      const { upper } = confidenceInterval95(arm.alpha, arm.beta);
      return {
        id,
        text: elementTextMap.get(id) ?? id,
        spendCents: arm.spendCents,
        upperBound: parseFloat(upper.toFixed(4)),
        reason: "upper_95_bound_below_2pct_conversion",
      };
    });
  }

  // ── 6. Hot-streak candidates across all kinds ─────────────────────────────────
  const hotStreakItems: HotStreakSummary[] = [];
  for (const kind of KINDS) {
    const arms = armsByKind[kind];
    const hotIds = hotStreakCandidates(arms, { minLower: 0.05, freshnessHours: 72 });
    for (const id of hotIds) {
      const arm = arms.find((a) => a.id === id)!;
      const { lower } = confidenceInterval95(arm.alpha, arm.beta);
      hotStreakItems.push({
        id,
        kind,
        text: elementTextMap.get(id) ?? id,
        lastUsedAt: arm.lastUsedAt?.toISOString() ?? null,
        lowerBound: parseFloat(lower.toFixed(4)),
      });
    }
  }

  // ── 7. Tag combo winners and losers ──────────────────────────────────────────
  const [tagWinners, tagLosers] = await Promise.all([
    listTopPerformingTagCombos({ dateFrom, dateTo, metric: "roas", limit: 10 }),
    listTopPerformingTagCombos({ dateFrom, dateTo, metric: "cpa_cents", limit: 10 }),
  ]);

  // ── 8. Compose deterministic note ────────────────────────────────────────────
  const topHooks = topElements("hook");
  const topHookClb = topHooks[0]?.confidenceLowerBound ?? 0;
  const totalRetirement = KINDS.reduce(
    (sum, k) => sum + retirementForKind(k).length,
    0,
  );
  const tagWinnerNote =
    tagWinners[0]?.tagFingerprint
      ? `tag combo "${tagWinners[0].tagFingerprint.slice(0, 40)}" is winning`
      : "no tag combo data yet";

  const note =
    `Top hook CLB ${topHookClb.toFixed(3)}; ` +
    `${totalRetirement} element${totalRetirement !== 1 ? "s" : ""} flagged for retirement; ` +
    tagWinnerNote;

  return {
    top_elements: {
      hooks: topElements("hook"),
      bodies: topElements("body"),
      ctas: topElements("cta"),
      visual_styles: topElements("visual_style"),
    },
    retirement_candidates: {
      hooks: retirementForKind("hook"),
      bodies: retirementForKind("body"),
      ctas: retirementForKind("cta"),
      visual_styles: retirementForKind("visual_style"),
    },
    tag_combo_winners: tagWinners.map((t) => ({
      combo: t.tagFingerprint,
      avgRoas: t.avgRoas,
      avgCtr: t.avgCtr,
      adCount: t.adCount,
    })),
    tag_combo_losers: tagLosers.map((t) => ({
      combo: t.tagFingerprint,
      avgCpaCents: t.avgCpaCents,
      adCount: t.adCount,
      reason: "highest_avg_cpa_in_window",
    })),
    hot_streak: hotStreakItems,
    sampling_mode: DEFAULT_SAMPLING_MODE,
    note,
  };
}

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
  const thirtyDaysAgo = nDaysAgo(30);

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

  // ── Phase 7c — Creative intelligence (30-day window) ────────────────────────
  const creative_intelligence = await buildCreativeIntelligence(thirtyDaysAgo, today);

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
    creative_intelligence,
  };

  return NextResponse.json(payload, { status: 200 });
}
