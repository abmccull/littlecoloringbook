import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { GraphClient } from "@littlecolorbook/meta/client";
import { createCampaign } from "@littlecolorbook/ads/campaigns";
import { createAdSet } from "@littlecolorbook/ads/adsets";
import { createAd } from "@littlecolorbook/ads/ads";
import { uploadAdImageBufferRaw } from "@littlecolorbook/ads/adimages";
import { createAdCreative } from "@littlecolorbook/ads/creatives";
import { generateDailyBriefs } from "@littlecolorbook/ads/brief-generator";
import { bundledCampaignTaxonomy } from "@littlecolorbook/ads/campaign-taxonomy";
import type { AdBrief } from "@littlecolorbook/ads/types";
import {
  getCreativeAssetById,
  upsertAdCampaign,
  upsertAdSet,
  upsertAd,
  upsertAdCreative,
  listCreativeAssets,
} from "@littlecolorbook/db/repositories";
import { downloadObject, type StorageBucketKind } from "@littlecolorbook/shared/storage";

type AudienceTag = "family" | "kids" | "pets";
type ResolvedCreativeImage = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

function mapBriefToAudience(brief: AdBrief): AudienceTag | undefined {
  const text = `${brief.persona ?? ""} ${brief.occasion ?? ""} ${brief.format ?? ""} ${brief.visualPrompt ?? ""}`.toLowerCase();
  if (text.includes("pet") || text.includes("dog") || text.includes("cat")) return "pets";
  if (text.includes("grandma") || text.includes("grandparent") || text.includes("family") || text.includes("sibling")) return "family";
  if (text.includes("kid") || text.includes("child") || text.includes("toddler")) return "kids";
  return undefined;
}

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bucketKindFor(bucketName: string): StorageBucketKind | null {
  if (bucketName === process.env.GCS_BUCKET_UPLOADS) return "uploads";
  if (bucketName === process.env.GCS_BUCKET_EXPORTS) return "exports";
  return null;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/jpeg":
    case "image/jpg":
    default:
      return ".jpg";
  }
}

async function loadCreativeAssetImage(input: {
  assetId: string;
  gcsBucket: string;
  gcsObject: string;
  mimeType: string;
}): Promise<ResolvedCreativeImage | null> {
  const bucketKind = bucketKindFor(input.gcsBucket);
  if (!bucketKind) return null;

  const buffer = await downloadObject({ bucket: bucketKind, objectPath: input.gcsObject });
  return {
    buffer,
    filename: `${input.assetId}${extensionForMimeType(input.mimeType)}`,
    mimeType: input.mimeType,
  };
}

// Pulls a hero from creative_assets matching the brief's audience tag and
// returns in-memory bytes ready for multipart upload.
async function resolveCreativeImage(brief: AdBrief): Promise<ResolvedCreativeImage | null> {
  const explicitAssetId = brief.imageAssetIds?.[0];
  if (explicitAssetId) {
    const explicitAsset = await getCreativeAssetById(explicitAssetId);
    if (!explicitAsset) {
      throw new Error(`Creative asset not found: ${explicitAssetId}`);
    }
    return loadCreativeAssetImage({
      assetId: explicitAsset.id,
      gcsBucket: explicitAsset.gcsBucket,
      gcsObject: explicitAsset.gcsObject,
      mimeType: explicitAsset.mimeType,
    });
  }

  const audience = mapBriefToAudience(brief);

  let candidates = await listCreativeAssets({
    source: "pipeline_test_batch",
    kind: "hero_image",
    complianceStatus: "passed",
    tagsQuery: audience ? { audience_tag: audience } : undefined,
    limit: 50,
  });

  if (candidates.length === 0 && audience) {
    // Fallback to any compliant library hero if audience-tagged set is empty.
    candidates = await listCreativeAssets({
      source: "pipeline_test_batch",
      kind: "hero_image",
      complianceStatus: "passed",
      limit: 50,
    });
  }

  if (candidates.length === 0) return null;

  const picked = candidates[stableHash(brief.slotKey) % candidates.length];
  return loadCreativeAssetImage({
    assetId: picked.id,
    gcsBucket: picked.gcsBucket,
    gcsObject: picked.gcsObject,
    mimeType: picked.mimeType,
  });
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ADS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// In-process rate limit tracker — resets on each deployment but safe for Vercel
// serverless since the cron invocations are sequential within a window.
let rateLimitWindowStart = 0;
let rateLimitCount = 0;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitWindowStart = now;
    rateLimitCount = 0;
  }
  if (rateLimitCount >= RATE_LIMIT_MAX_ADS) {
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - rateLimitWindowStart) + 1000;
    await sleep(waitMs);
    rateLimitWindowStart = Date.now();
    rateLimitCount = 0;
  }
  rateLimitCount++;
}

type BatchSummary = {
  processed: number;
  created: number;
  skipped: number;
  errors: Array<{ slotKey: string; error: string }>;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  // ── Feature flag: dormant by default ───────────────────────────────────────
  if (process.env.PAID_ADS_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "paid_ads_disabled" }, { status: 200 });
  }

  // ── Env validation ─────────────────────────────────────────────────────────
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;
  const pixelId = process.env.META_PIXEL_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v22.0";

  if (!token || !rawAccountId || !pageId || !pixelId) {
    return NextResponse.json(
      { error: "Missing required env: META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID, META_PIXEL_ID" },
      { status: 503 },
    );
  }

  // Strip leading "act_" if present so we can add it consistently below.
  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId.slice(4) : rawAccountId;

  // ── Hard caps ──────────────────────────────────────────────────────────────
  const maxAdsPerDay = parseInt(process.env.MAX_ADS_PER_DAY ?? "20", 10);
  const perAdDailyBudgetCents = parseInt(process.env.PER_AD_DAILY_BUDGET_CENTS ?? "500", 10);

  // ── Batch sizing ───────────────────────────────────────────────────────────
  // Cron runs 3x/day; each run handles ~1/3 of the daily quota.
  const batchSize = Math.ceil(maxAdsPerDay / 3);

  const today = new Date().toISOString().slice(0, 10);

  // ── Generate briefs ────────────────────────────────────────────────────────
  let briefs;
  try {
    briefs = generateDailyBriefs({
      taxonomy: bundledCampaignTaxonomy,
      count: batchSize,
      seed: today,
      date: today,
      linkUrl: process.env.AD_LINK_URL ?? "https://littlecoloringbook.com/free-sample",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate briefs", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const client = new GraphClient({ accessToken: token, version: apiVersion, adAccountId });

  // ── Ensure a top-level campaign exists for today's batch ──────────────────
  let campaignMetaId: string;
  try {
    const campaignResult = await createCampaign({
      client,
      adAccountId,
      name: `LCB Daily Batch — ${today}`,
      objective: "OUTCOME_SALES",
      status: "PAUSED",
    });
    campaignMetaId = campaignResult.id;

    await upsertAdCampaign({
      metaId: campaignMetaId,
      name: `LCB Daily Batch — ${today}`,
      objective: "OUTCOME_SALES",
      status: "PAUSED",
      adAccountId: `act_${adAccountId}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create/upsert campaign", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const summary: BatchSummary = { processed: 0, created: 0, skipped: 0, errors: [] };

  // ── Process each brief ─────────────────────────────────────────────────────
  for (const brief of briefs) {
    summary.processed++;

    try {
      await enforceRateLimit();

      let resolvedImage: ResolvedCreativeImage | null = null;
      try {
        resolvedImage = await resolveCreativeImage(brief);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push({ slotKey: brief.slotKey, error: `creative-library lookup failed: ${msg}` });
        summary.skipped++;
        continue;
      }

      if (!resolvedImage) {
        summary.errors.push({ slotKey: brief.slotKey, error: "No creative image available for brief." });
        summary.skipped++;
        continue;
      }

      // (a) Upload image → hash
      const { hash: imageHash } = await uploadAdImageBufferRaw({
        accessToken: token,
        version: apiVersion,
        adAccountId,
        imageBuffer: resolvedImage.buffer,
        filename: resolvedImage.filename,
        mimeType: resolvedImage.mimeType,
      });

      // (b) Create ad creative
      const creativeResult = await createAdCreative({
        client,
        adAccountId,
        name: `Creative — ${brief.slotKey}`,
        pageId,
        linkUrl: brief.linkUrl,
        message: `${brief.hook}\n\n${brief.body}`,
        imageHash,
        cta: brief.cta,
      });

      await upsertAdCreative({
        metaId: creativeResult.id,
        name: `Creative — ${brief.slotKey}`,
        briefRef: brief.slotKey,
      });

      // (c) Create ad set — one per ad, $5/day default
      const adSetResult = await createAdSet({
        client,
        adAccountId,
        campaignId: campaignMetaId,
        name: `AdSet — ${brief.slotKey}`,
        dailyBudgetCents: perAdDailyBudgetCents,
        optimizationGoal: "OFFSITE_CONVERSIONS",
        billingEvent: "IMPRESSIONS",
        targeting: {
          geo_locations: { countries: ["US", "CA", "GB", "AU"] },
          age_min: 25,
          age_max: 70,
        },
        pixelId,
        status: "PAUSED",
      });

      await upsertAdSet({
        metaId: adSetResult.id,
        campaignId: campaignMetaId,
        name: `AdSet — ${brief.slotKey}`,
        status: "PAUSED",
        dailyBudgetCents: perAdDailyBudgetCents,
        optimizationGoal: "OFFSITE_CONVERSIONS",
        billingEvent: "IMPRESSIONS",
        targetingJson: { geo_locations: { countries: ["US", "CA", "GB", "AU"] }, age_min: 25, age_max: 70 },
      });

      // (d) Create ad — always paused; human flips to ACTIVE
      const adResult = await createAd({
        client,
        adAccountId,
        adSetId: adSetResult.id,
        name: `Ad — ${brief.slotKey}`,
        adCreativeId: creativeResult.id,
        status: "PAUSED",
      });

      await upsertAd({
        metaId: adResult.id,
        adSetId: adSetResult.id,
        name: `Ad — ${brief.slotKey}`,
        status: "PAUSED",
        adCreativeMetaId: creativeResult.id,
      });

      summary.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ slotKey: brief.slotKey, error: message });
      summary.skipped++;
    }
  }

  return NextResponse.json(summary, { status: 200 });
}
