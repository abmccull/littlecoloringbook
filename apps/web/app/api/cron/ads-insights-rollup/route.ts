import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { GraphClient } from "@littlecolorbook/meta";
import { fetchAdsInsights } from "@littlecolorbook/ads";
import {
  isDatabaseConfigured,
  upsertAdDailyMetrics,
  upsertAdSetDailyMetrics,
  upsertCampaignDailyMetrics,
  listNonDeletedAds,
  listNonDeletedAdSets,
} from "@littlecolorbook/db";

// Fields we request from the async insights job.
const INSIGHTS_FIELDS = [
  "impressions",
  "reach",
  "frequency",
  "spend",
  "clicks",
  "inline_link_clicks",
  "actions",
  "action_values",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "cpm",
  "ctr",
  "date_start",
  "date_stop",
] as const;

type InsightsRow = Record<string, unknown>;

// ─── Action extraction helpers ────────────────────────────────────────────────

function extractAction(actions: unknown, actionType: string): number {
  if (!Array.isArray(actions)) return 0;
  const match = (actions as Array<{ action_type: string; value: string }>).find(
    (a) => a.action_type === actionType,
  );
  return match ? parseInt(match.value ?? "0", 10) : 0;
}

function extractActionValue(actionValues: unknown, actionType: string): number {
  if (!Array.isArray(actionValues)) return 0;
  const match = (actionValues as Array<{ action_type: string; value: string }>).find(
    (a) => a.action_type === actionType,
  );
  return match ? Math.round(parseFloat(match.value ?? "0") * 100) : 0;
}

function extractVideoActions(
  videoActions: unknown,
  actionType: string,
): number {
  if (!Array.isArray(videoActions)) return 0;
  const match = (videoActions as Array<{ action_type: string; value: string }>).find(
    (a) => a.action_type === actionType,
  );
  return match ? parseInt(match.value ?? "0", 10) : 0;
}

// ─── Row normalizer ───────────────────────────────────────────────────────────

function normalizeInsightsRow(
  row: InsightsRow,
  entityMetaId: string,
  date: string,
) {
  const impressions = parseInt(String(row.impressions ?? "0"), 10);
  const reach = parseInt(String(row.reach ?? "0"), 10);
  const frequency = row.frequency != null ? String(row.frequency) : null;
  const spendDollars = parseFloat(String(row.spend ?? "0"));
  const spendCents = Math.round(spendDollars * 100);
  const clicks = parseInt(String(row.clicks ?? "0"), 10);
  const linkClicks = parseInt(String(row.inline_link_clicks ?? "0"), 10);
  const ctr = row.ctr != null ? String(row.ctr) : null;
  const cpmDollars = row.cpm != null ? parseFloat(String(row.cpm)) : null;
  const cpmCents = cpmDollars != null ? Math.round(cpmDollars * 100) : null;

  const actions = row.actions;
  const actionValues = row.action_values;

  const landingPageViews = extractAction(actions, "landing_page_view");
  const addsToCart = extractAction(actions, "add_to_cart");
  const initiateCheckouts = extractAction(actions, "initiate_checkout");
  const purchases = extractAction(actions, "purchase");
  const revenueCents = extractActionValue(actionValues, "purchase");

  const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : null;
  const cpaCents = purchases > 0 ? Math.round(spendCents / purchases) : null;
  const roas = spendCents > 0 ? String((revenueCents / spendCents).toFixed(4)) : null;

  const videoP25Views = extractVideoActions(row.video_p25_watched_actions, "video_view");
  const videoP50Views = extractVideoActions(row.video_p50_watched_actions, "video_view");
  const videoP75Views = extractVideoActions(row.video_p75_watched_actions, "video_view");
  const videoP100Views = extractVideoActions(row.video_p100_watched_actions, "video_view");

  const hookRate =
    impressions > 0
      ? String((videoP25Views / impressions).toFixed(4))
      : null;

  return {
    entityMetaId,
    date,
    impressions,
    reach,
    frequency,
    spendCents,
    clicks,
    linkClicks,
    landingPageViews,
    addsToCart,
    initiateCheckouts,
    purchases,
    revenueCents,
    ctr,
    cpmCents,
    cpcCents,
    cpaCents,
    roas,
    videoP25Views,
    videoP50Views,
    videoP75Views,
    videoP100Views,
    hookRate,
    lastSyncedAt: new Date(),
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type RollupSummary = {
  ads_rows_updated: number;
  adsets_rows_updated: number;
  campaigns_rows_updated: number;
  window_labels: string[];
  errors: string[];
};

type RequestedWindow = {
  label: string;
  fallbackDate: string;
  datePreset?: "today" | "yesterday";
  timeRange?: { since: string; until: string };
  timeIncrement?: number;
};

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

function buildRequestedWindows(request: NextRequest): RequestedWindow[] {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!from && !to) {
    return [
      { label: "yesterday", fallbackDate: yesterdayString(), datePreset: "yesterday" },
      { label: "today", fallbackDate: todayString(), datePreset: "today" },
    ];
  }

  if (!isIsoDate(from) || !isIsoDate(to) || compareIsoDates(from, to) > 0) {
    throw new Error("from and to must be YYYY-MM-DD dates with from <= to");
  }

  const windows: RequestedWindow[] = [];
  let cursor = from;

  while (compareIsoDates(cursor, to) <= 0) {
    const windowEnd = compareIsoDates(addDays(cursor, 29), to) <= 0 ? addDays(cursor, 29) : to;
    windows.push({
      label: `${cursor}:${windowEnd}`,
      fallbackDate: cursor,
      timeRange: { since: cursor, until: windowEnd },
      timeIncrement: 1,
    });
    cursor = addDays(windowEnd, 1);
  }

  return windows;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const token = process.env.META_SYSTEM_USER_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v22.0";

  if (!token || !rawAccountId) {
    return NextResponse.json(
      { error: "Missing required env: META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID" },
      { status: 503 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId.slice(4) : rawAccountId;
  const client = new GraphClient({ accessToken: token, version: apiVersion, adAccountId });

  let windows: RequestedWindow[];
  try {
    windows = buildRequestedWindows(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid rollup window" },
      { status: 400 },
    );
  }

  const summary: RollupSummary = {
    ads_rows_updated: 0,
    adsets_rows_updated: 0,
    campaigns_rows_updated: 0,
    window_labels: windows.map((window) => window.label),
    errors: [],
  };

  // ── Ad-level rollup ───────────────────────────────────────────────────────
  const dbAds = await listNonDeletedAds();
  if (dbAds.length > 0) {
    const adMetaIds = dbAds.map((a) => a.metaId);

    for (const window of windows) {
      try {
        const rows = await fetchAdsInsights({
          client,
          entityId: `act_${adAccountId}`,
          level: "ad",
          ...(window.datePreset ? { datePreset: window.datePreset } : {}),
          ...(window.timeRange ? { timeRange: window.timeRange, timeIncrement: window.timeIncrement } : {}),
          fields: [...INSIGHTS_FIELDS],
          filtering: [
            { field: "ad.id", operator: "IN", value: adMetaIds },
          ],
        });

        for (const row of rows) {
          const entityMetaId = String(row.ad_id ?? row.id ?? "");
          if (!entityMetaId) continue;
          const date = String((row.date_start as string | undefined) ?? window.fallbackDate);
          try {
            await upsertAdDailyMetrics(normalizeInsightsRow(row, entityMetaId, date));
            summary.ads_rows_updated++;
          } catch (err) {
            summary.errors.push(`ad upsert ${entityMetaId} ${date}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        summary.errors.push(`ad insights ${window.label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── Adset-level rollup ────────────────────────────────────────────────────
  const dbAdSets = await listNonDeletedAdSets();
  if (dbAdSets.length > 0) {
    const adSetMetaIds = dbAdSets.map((s) => s.metaId);

    for (const window of windows) {
      try {
        const rows = await fetchAdsInsights({
          client,
          entityId: `act_${adAccountId}`,
          level: "adset",
          ...(window.datePreset ? { datePreset: window.datePreset } : {}),
          ...(window.timeRange ? { timeRange: window.timeRange, timeIncrement: window.timeIncrement } : {}),
          fields: [...INSIGHTS_FIELDS],
          filtering: [
            { field: "adset.id", operator: "IN", value: adSetMetaIds },
          ],
        });

        for (const row of rows) {
          const entityMetaId = String(row.adset_id ?? row.id ?? "");
          if (!entityMetaId) continue;
          const date = String((row.date_start as string | undefined) ?? window.fallbackDate);
          try {
            await upsertAdSetDailyMetrics(normalizeInsightsRow(row, entityMetaId, date));
            summary.adsets_rows_updated++;
          } catch (err) {
            summary.errors.push(`adset upsert ${entityMetaId} ${date}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        summary.errors.push(`adset insights ${window.label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── Campaign-level rollup ─────────────────────────────────────────────────
  for (const window of windows) {
    try {
      const rows = await fetchAdsInsights({
        client,
        entityId: `act_${adAccountId}`,
        level: "campaign",
        ...(window.datePreset ? { datePreset: window.datePreset } : {}),
        ...(window.timeRange ? { timeRange: window.timeRange, timeIncrement: window.timeIncrement } : {}),
        fields: [...INSIGHTS_FIELDS],
      });

      for (const row of rows) {
        const entityMetaId = String(row.campaign_id ?? row.id ?? "");
        if (!entityMetaId) continue;
        const date = String((row.date_start as string | undefined) ?? window.fallbackDate);
        try {
          await upsertCampaignDailyMetrics(normalizeInsightsRow(row, entityMetaId, date));
          summary.campaigns_rows_updated++;
        } catch (err) {
          summary.errors.push(`campaign upsert ${entityMetaId} ${date}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      summary.errors.push(`campaign insights ${window.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json(summary, { status: 200 });
}
