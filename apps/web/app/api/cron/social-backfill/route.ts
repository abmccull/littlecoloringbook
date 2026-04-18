import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  listUpcomingOrganicPosts,
  listCreativeAssets,
  listRecentlyUsedCreativeAssetIds,
  insertBackfilledOrganicPost,
} from "@littlecolorbook/db";
import {
  DEFAULT_SLOT_CONFIG,
  enumerateSlotsForWindow,
  findUnfilledSlots,
  scoreCreativeMatch,
} from "@littlecolorbook/social";
import type { Slot, SlotCreativeAsset } from "@littlecolorbook/social";
import type { CreativeAsset } from "@littlecolorbook/db";

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKFILL_WINDOW_HOURS = 48;
const MAX_BACKFILLS_PER_RUN = 20;
const RECENT_USE_DAYS = 14;

// Formats for which we skip backfill if no suitable asset exists (e.g. reel
// requires video assets which depend on Phase 2d — not yet available).
const SKIP_FORMATS_WITHOUT_ASSET = new Set(["reel"]);

// ─── Caption generation ───────────────────────────────────────────────────────

/**
 * Deterministic caption template. Uses the asset's tags to pick a persona-aware
 * caption. LLM-generated captions are a Phase 3c feature; v1 uses templates.
 */
function buildCaption(asset: CreativeAsset): string {
  const { persona, occasion, hook_family } = asset.tagsJson ?? {};

  const hookMap: Record<string, string> = {
    transformation: "From a photo to a coloring page — in under 48 hours.",
    social_proof: "Thousands of families have turned their photos into coloring memories.",
    question: "What if your kids could color memories, not cartoons?",
    story: "My daughter cried when she saw herself in a coloring book.",
    curiosity: "There's a coloring book with your child's face on every page.",
    urgency: "Don't let their childhood slip by uncelebrated.",
    objection: "No artistic skill needed — we design it for you.",
    stat: "Personalized gifts are 3× more likely to be treasured.",
  };

  const occasionMap: Record<string, string> = {
    birthday: "Perfect for their next birthday!",
    holiday: "A gift they'll remember every holiday season.",
    mothers_day: "The most personal Mother's Day gift you can give.",
    grandparent_gift: "Grandma hasn't put it down since we gave it to her.",
    back_to_school: "Make back-to-school season unforgettable.",
  };

  const personaMap: Record<string, string> = {
    warm_millennial_mom: "Made for the moments you never want to forget.",
    organized_practical_mom: "Simple to order, beautiful to receive.",
    emotional_keepsake_mom: "A keepsake they'll treasure for years.",
    grandma_gift_buyer: "The gift grandchildren will color again and again.",
    homeschool_screenfree_mom: "Screen-free creativity, powered by your own photos.",
    lifestyle_gift_creator: "The gift that always gets a reaction.",
  };

  const hook = (hook_family && hookMap[hook_family]) ?? hookMap["transformation"];
  const occasionLine = (occasion && occasion !== "evergreen" && occasionMap[occasion]) ?? null;
  const personaLine = (persona && personaMap[persona]) ?? null;

  const body =
    "Little Color Book turns your favorite family photos into hand-crafted coloring page art. " +
    "Perfect for rainy days, road trips, and quiet afternoons. Every page is 100% personalized — no stock art, ever.";

  const cta = "Try a free sample at littlecoloringbook.com";

  const parts = [hook, occasionLine ?? personaLine ?? body, cta].filter(Boolean);
  return parts.join("\n\n");
}

// ─── Asset → format compatibility ────────────────────────────────────────────

const FORMAT_ACCEPTED_KINDS: Record<string, string[]> = {
  single_image: ["hero_image", "aspect_1x1", "aspect_4x5", "aspect_9x16"],
  story: ["hero_image", "aspect_9x16"],
  reel: ["video"],
  carousel: ["hero_image", "aspect_1x1", "aspect_4x5"],
};

function isAssetCompatibleWithSlot(asset: CreativeAsset, slot: Slot): boolean {
  const accepted = FORMAT_ACCEPTED_KINDS[slot.format] ?? [];
  return accepted.includes(asset.kind);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  // Feature flag — off by default so this cron is dormant until explicitly enabled
  if (process.env.SOCIAL_BACKFILL_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "disabled" });
  }

  const timezone = process.env.SOCIAL_BACKFILL_TZ ?? "America/New_York";

  const now = new Date();
  const windowEnd = new Date(now.getTime() + BACKFILL_WINDOW_HOURS * 60 * 60 * 1000);

  // ── Load existing posts in the window ──────────────────────────────────────
  const existingPosts = await listUpcomingOrganicPosts({ fromDate: now, toDate: windowEnd });

  // ── Compute unfilled slots ─────────────────────────────────────────────────
  const allSlots = enumerateSlotsForWindow(DEFAULT_SLOT_CONFIG, now, windowEnd, timezone);
  const unfilledSlots = findUnfilledSlots(allSlots, existingPosts);

  if (unfilledSlots.length === 0) {
    return NextResponse.json({
      processed: 0,
      filled: 0,
      skipped_no_asset: 0,
      skipped_existing: existingPosts.length,
      errors: [],
    });
  }

  // ── Load creative assets (compliance=passed only) ──────────────────────────
  const [allAssets, recentlyUsedIds] = await Promise.all([
    listCreativeAssets({ complianceStatus: "passed", limit: 500 }),
    listRecentlyUsedCreativeAssetIds({ sinceDaysAgo: RECENT_USE_DAYS }),
  ]);

  const recentlyUsedSet = new Set(recentlyUsedIds);

  // Annotate assets with recently-used flag for the scorer
  const scorableAssets: Array<CreativeAsset & { recentlyUsed: boolean }> = allAssets.map((a) => ({
    ...a,
    recentlyUsed: recentlyUsedSet.has(a.id),
  }));

  // ── Fill slots ─────────────────────────────────────────────────────────────
  let filled = 0;
  let skippedNoAsset = 0;
  const errors: string[] = [];

  const slotsToProcess = unfilledSlots.slice(0, MAX_BACKFILLS_PER_RUN);

  for (const slot of slotsToProcess) {
    try {
      // Filter assets compatible with this slot's format
      const compatible = scorableAssets.filter((a) => isAssetCompatibleWithSlot(a, slot));

      if (compatible.length === 0) {
        if (SKIP_FORMATS_WITHOUT_ASSET.has(slot.format)) {
          // Reel (and other video-only formats) are silently skipped until Phase 2d
          continue;
        }
        skippedNoAsset++;
        continue;
      }

      // Score and pick best asset
      const scored = compatible
        .map((asset) => ({
          asset,
          score: scoreCreativeMatch(slot, asset as SlotCreativeAsset, {}),
        }))
        .sort((a, b) => b.score - a.score);

      const bestAsset = scored[0]?.asset;
      if (!bestAsset) {
        skippedNoAsset++;
        continue;
      }

      const caption = buildCaption(bestAsset);
      const postId = `op_bf_${crypto.randomUUID()}`;
      const backfilledAt = new Date();

      await insertBackfilledOrganicPost({
        id: postId,
        platform: slot.platform,
        format: slot.format,
        caption,
        imageAssetIds: [bestAsset.gcsObject],
        scheduledAt: slot.scheduledAt,
        sourceCreativeAssetId: bestAsset.id,
        backfilledAt,
        createdBy: "backfill-cron",
      });

      // Mark as recently-used in-memory so subsequent slots in this run
      // don't over-select the same asset
      recentlyUsedSet.add(bestAsset.id);

      filled++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`slot ${slot.localTimeLabel} (${slot.platform}/${slot.format}): ${message}`);
    }
  }

  return NextResponse.json({
    processed: slotsToProcess.length,
    filled,
    skipped_no_asset: skippedNoAsset,
    skipped_existing: existingPosts.length,
    errors,
  });
}
