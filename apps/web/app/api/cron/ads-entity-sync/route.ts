import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { GraphClient } from "@littlecolorbook/meta";
import { getAd, getAdSet, getCampaign } from "@littlecolorbook/ads";
import {
  isDatabaseConfigured,
  upsertAd,
  upsertAdSet,
  upsertAdCampaign,
  markEntitySynced,
  recordMetaApiCall,
  listNonDeletedAds,
  listNonDeletedAdSets,
  listNonDeletedCampaigns,
} from "@littlecolorbook/db";
import crypto from "node:crypto";

type SyncSummary = {
  ads: number;
  adSets: number;
  campaigns: number;
  drift_count: number;
  errors: string[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function logDrift(endpoint: string, description: string): Promise<void> {
  try {
    await recordMetaApiCall({
      id: crypto.randomUUID(),
      method: "GET",
      endpoint,
      responseExcerpt: description,
    });
  } catch {
    // drift logging is fire-and-forget; never crash sync on log failure
  }
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

  const dbAds = await listNonDeletedAds();
  if (dbAds.length === 0) {
    return NextResponse.json({ processed: 0, reason: "no_entities" }, { status: 200 });
  }

  const client = new GraphClient({ accessToken: token, version: apiVersion, adAccountId });
  const summary: SyncSummary = { ads: 0, adSets: 0, campaigns: 0, drift_count: 0, errors: [] };

  // Track upstream IDs seen during ad sync so we don't double-fetch.
  const adSetMetaIds = new Set<string>();
  const campaignMetaIds = new Set<string>();

  // ── Sync ads (batch of 10) ─────────────────────────────────────────────────
  for (const batch of chunk(dbAds, 10)) {
    await Promise.all(
      batch.map(async (dbAd) => {
        try {
          const metaAd = await getAd({
            client,
            adId: dbAd.metaId,
            fields: ["id", "name", "status", "adset_id", "creative"],
          });

          const metaStatus = String(metaAd.status ?? "");
          const metaName = String(metaAd.name ?? dbAd.name);
          const creative = metaAd.creative as { id?: string } | undefined;
          const adCreativeMetaId = creative?.id ?? dbAd.adCreativeMetaId;
          const adSetMetaId = String(metaAd.adset_id ?? "");

          if (metaStatus && metaStatus !== dbAd.status) {
            summary.drift_count++;
            await logDrift(
              "sync/drift",
              `ad ${dbAd.metaId}: DB status=${dbAd.status} Meta status=${metaStatus}`,
            );
          }

          await upsertAd({
            metaId: dbAd.metaId,
            adSetId: dbAd.adSetId,
            name: metaName,
            status: metaStatus || dbAd.status,
            adCreativeMetaId: adCreativeMetaId ?? null,
          });

          await markEntitySynced({ entityType: "ad", metaId: dbAd.metaId });

          if (adSetMetaId) adSetMetaIds.add(adSetMetaId);
          summary.ads++;
        } catch (err) {
          summary.errors.push(`ad ${dbAd.metaId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );
  }

  // ── Sync ad sets ──────────────────────────────────────────────────────────
  const dbAdSets = await listNonDeletedAdSets();
  for (const s of dbAdSets) adSetMetaIds.add(s.metaId);

  for (const batch of chunk([...adSetMetaIds], 10)) {
    await Promise.all(
      batch.map(async (adSetMetaId) => {
        try {
          const metaAdSet = await getAdSet({
            client,
            adSetId: adSetMetaId,
            fields: ["id", "name", "status", "campaign_id", "daily_budget", "optimization_goal", "billing_event"],
          });

          const dbAdSet = dbAdSets.find((s) => s.metaId === adSetMetaId);
          const metaStatus = String(metaAdSet.status ?? "");
          const metaCampaignId = String(metaAdSet.campaign_id ?? "");

          if (dbAdSet && metaStatus && metaStatus !== dbAdSet.status) {
            summary.drift_count++;
            await logDrift(
              "sync/drift",
              `adset ${adSetMetaId}: DB status=${dbAdSet.status} Meta status=${metaStatus}`,
            );
          }

          if (dbAdSet) {
            await upsertAdSet({
              metaId: adSetMetaId,
              campaignId: dbAdSet.campaignId,
              name: String(metaAdSet.name ?? dbAdSet.name),
              status: metaStatus || dbAdSet.status,
              dailyBudgetCents: metaAdSet.daily_budget != null
                ? parseInt(String(metaAdSet.daily_budget), 10)
                : dbAdSet.dailyBudgetCents,
              optimizationGoal: String(metaAdSet.optimization_goal ?? dbAdSet.optimizationGoal),
              billingEvent: metaAdSet.billing_event != null
                ? String(metaAdSet.billing_event)
                : dbAdSet.billingEvent,
            });
            await markEntitySynced({ entityType: "adset", metaId: adSetMetaId });
          }

          if (metaCampaignId) campaignMetaIds.add(metaCampaignId);
          summary.adSets++;
        } catch (err) {
          summary.errors.push(`adset ${adSetMetaId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );
  }

  // ── Sync campaigns ────────────────────────────────────────────────────────
  const dbCampaigns = await listNonDeletedCampaigns();
  for (const c of dbCampaigns) campaignMetaIds.add(c.metaId);

  for (const batch of chunk([...campaignMetaIds], 10)) {
    await Promise.all(
      batch.map(async (campaignMetaId) => {
        try {
          const metaCampaign = await getCampaign({
            client,
            campaignId: campaignMetaId,
            fields: ["id", "name", "status", "objective"],
          });

          const dbCampaign = dbCampaigns.find((c) => c.metaId === campaignMetaId);
          const metaStatus = String(metaCampaign.status ?? "");

          if (dbCampaign && metaStatus && metaStatus !== dbCampaign.status) {
            summary.drift_count++;
            await logDrift(
              "sync/drift",
              `campaign ${campaignMetaId}: DB status=${dbCampaign.status} Meta status=${metaStatus}`,
            );
          }

          if (dbCampaign) {
            await upsertAdCampaign({
              metaId: campaignMetaId,
              name: String(metaCampaign.name ?? dbCampaign.name),
              objective: String(metaCampaign.objective ?? dbCampaign.objective),
              status: metaStatus || dbCampaign.status,
              adAccountId: dbCampaign.adAccountId,
            });
            await markEntitySynced({ entityType: "campaign", metaId: campaignMetaId });
          }

          summary.campaigns++;
        } catch (err) {
          summary.errors.push(`campaign ${campaignMetaId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );
  }

  return NextResponse.json(summary, { status: 200 });
}
