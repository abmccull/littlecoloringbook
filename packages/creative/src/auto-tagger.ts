/**
 * auto-tagger.ts
 *
 * Phase 7b — Visual Semantic Auto-Tagger
 *
 * Sends a creative_asset image to Claude Sonnet (vision) and returns a rich
 * set of semantic tags. Tags are stored in creative_assets.semantic_tags
 * (JSONB) and used for performance attribution — not compliance.
 *
 * INTEGRATION NOTE FOR PARALLEL PR (orchestrator.ts):
 *   After producing a new hero asset, call:
 *     autoTagAndPersist({ asset, db }).catch((err) =>
 *       console.warn("[auto-tagger] fire-and-forget failed:", err),
 *     );
 *   The function is intentionally async/void-safe; errors are swallowed after
 *   logging so they never block creative production.
 *
 * Cost model (claude-sonnet-4-5-20251022 vision):
 *   Input:  ~$3.00/MTok  →  1024×1024 image ≈ 1 200 tok  → ~$0.0036
 *   Output: ~$15.00/MTok →  ~300 tok output              → ~$0.0045
 *   Total per image: ~$0.008 (rounds to ~$0.01)
 *   50 heroes: ~$0.40
 */

import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@littlecolorbook/shared/env";
import { downloadObject } from "@littlecolorbook/shared/storage";
import { SemanticTagsSchema, TAGGER_VERSION } from "./semantic-tags";
import type { SemanticTags } from "./semantic-tags";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-5-20251022";
const TIMEOUT_MS = 20_000;
const LRU_MAX_SIZE = 200;

// ─── Safe default tags (returned on any error) ────────────────────────────────

function safeDefaultTags(model: string): SemanticTags {
  return {
    scene_type: "unknown",
    subject_types: [],
    props: [],
    tagger_model: model,
    tagger_version: TAGGER_VERSION,
  };
}

// ─── LRU cache (SHA-256 of image buffer → SemanticTags) ──────────────────────
// Keeps a bounded in-process cache so repeated retag calls (e.g. in the
// backfill script) don't re-call the API for the same image content.

type LruEntry = { key: string; value: SemanticTags };

class LruCache {
  private readonly maxSize: number;
  private readonly map = new Map<string, SemanticTags>();
  private readonly order: string[] = [];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): SemanticTags | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to back (most-recently-used)
      const idx = this.order.indexOf(key);
      if (idx !== -1) this.order.splice(idx, 1);
      this.order.push(key);
    }
    return value;
  }

  set(key: string, value: SemanticTags): void {
    if (this.map.has(key)) {
      const idx = this.order.indexOf(key);
      if (idx !== -1) this.order.splice(idx, 1);
    } else if (this.order.length >= this.maxSize) {
      // Evict LRU
      const evict = this.order.shift();
      if (evict) this.map.delete(evict);
    }
    this.map.set(key, value);
    this.order.push(key);
  }

  clear(): void {
    this.map.clear();
    this.order.length = 0;
  }

  get size(): number {
    return this.map.size;
  }
}

const _tagCache = new LruCache(LRU_MAX_SIZE);

/** Exposed for test assertions only — do not call in production code. */
export function _tagCacheForTests(): LruCache {
  return _tagCache;
}

// ─── Anthropic client singleton ───────────────────────────────────────────────

let _clientKey: string | null = null;
let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const { apiKey } = getAnthropicEnv();
  // Explicitly guard non-empty string to avoid constructing with null/undefined key
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") return null;
  if (_client === null || _clientKey !== apiKey) {
    _client = new Anthropic({ apiKey });
    _clientKey = apiKey;
  }
  return _client;
}

/** Reset singleton — for tests only. */
export function _resetAutoTaggerClientForTests(): void {
  _client = null;
  _clientKey = null;
  _tagCache.clear();
}

// ─── System prompt (stable → prompt-cached) ───────────────────────────────────

export function makeAutoTaggerSystemPrompt(): string {
  return `You are a visual semantic tagger for "little color book", a brand that makes \
personalized coloring books from family photos. Your job is to analyse the provided \
image and return a rich JSON object describing its visual attributes.

## Output format

Respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON. \
The object must match this schema:

{
  "scene_type": "indoor"|"outdoor"|"studio"|"vehicle"|"mixed"|"unknown",
  "setting": "home"|"park"|"beach"|"vacation"|"birthday"|"school"|"restaurant"|"other"|"unknown",
  "subject_types": array of: "family","couple","adult_solo","kid_solo","kids_group","toddler","baby","pet_dog","pet_cat","pet_other","object_only",
  "subject_count": integer 0–10,
  "props": array of: "toy","book","food","pet","gift","sports_equipment","musical_instrument","vehicle","screen","nature_object","none",
  "emotion": "joyful"|"calm"|"playful"|"serious"|"surprised"|"affectionate"|"neutral"|"unknown",
  "pose": "portrait"|"action"|"candid"|"posed"|"group_shot"|"unknown",
  "style": {
    "line_weight": "thin"|"medium"|"thick"|"mixed",
    "detail_level": "minimal"|"simple"|"medium"|"detailed",
    "background": "white"|"sparse"|"suggested"|"detailed",
    "subject_framing": "close_up"|"medium"|"wide"|"full_scene"
  },
  "complexity_score": integer 1–5 (1=very simple line art, 5=highly detailed scene),
  "child_recognition_risk": "low"|"medium"|"high"
}

## Rules
- Include only keys you are confident about. Omit unknown/uncertain fields rather than guessing.
- "subject_types" and "props" are arrays; include all that apply.
- For coloring-book style images (line art), set style.line_weight and style.detail_level accordingly.
- "child_recognition_risk": high = face clearly identifiable, medium = partially visible/obscured, low = no children or back of head only.
- Do NOT include "tagger_model" or "tagger_version" in your output — those are added by the caller.`;
}

const SYSTEM_PROMPT = makeAutoTaggerSystemPrompt();

// ─── Core tagger ─────────────────────────────────────────────────────────────

export type AutoTagInput = {
  /** Raw image bytes */
  imageBuffer: Buffer;
  /** MIME type e.g. "image/png" */
  mimeType: string;
  /** Optional hint tags already known about this asset (e.g. audience_tag) */
  hintTags?: Record<string, string>;
};

/**
 * Send an image to Claude vision and return semantic tags.
 *
 * Never throws — on any error it returns safe default tags and emits a console
 * warning so tagging failures never block creative production.
 *
 * The function is intentionally call-safe for fire-and-forget use in the
 * orchestrator. Cache key is SHA-256(imageBuffer) so identical images within
 * the same process are free.
 */
export async function autoTagCreativeAsset(input: AutoTagInput): Promise<SemanticTags> {
  const env = getAnthropicEnv();
  // Prefer explicit override env var; fall back to the visionModel field in
  // AnthropicEnv (which itself defaults to DEFAULT_MODEL via env schema).
  const model = (process.env.ANTHROPIC_MODEL_VISION ?? env.visionModel ?? DEFAULT_MODEL);

  // ── Cache check ────────────────────────────────────────────────────────────
  const cacheKey = crypto.createHash("sha256").update(input.imageBuffer).digest("hex");
  const cached = _tagCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // ── Client check (after model resolved using visionModel from env) ────────
  const client = getClient();
  if (!client) {
    console.warn("[auto-tagger] ANTHROPIC_API_KEY not configured — returning safe defaults");
    return safeDefaultTags(model);
  }

  // ── Build base64 image data ────────────────────────────────────────────────
  const base64Data = input.imageBuffer.toString("base64");
  const mediaType = input.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp";

  // ── Abort controller for timeout ───────────────────────────────────────────
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawText: string;

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            // Stable system prompt — prompt-cache it so repeated calls in the
            // backfill script hit the cache tier (~$0.30/MTok instead of $3/MTok).
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: buildUserText(input.hintTags),
              },
            ],
          },
        ],
      },
      {
        signal: controller.signal,
      },
    );

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("LLM returned no text content block");
    }
    rawText = firstBlock.text;
  } catch (err) {
    console.warn("[auto-tagger] API call failed — returning safe defaults:", (err as Error)?.message);
    return safeDefaultTags(model);
  } finally {
    clearTimeout(timeoutHandle);
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  const tags = parseTagsResponse(rawText, model);

  // ── Cache + return ─────────────────────────────────────────────────────────
  _tagCache.set(cacheKey, tags);
  return tags;
}

// ─── Orchestrator integration helper ─────────────────────────────────────────

/**
 * Full pipeline: fetch GCS object → auto-tag → persist.
 *
 * Call this from the orchestrator (parallel PR) on new hero assets:
 *   autoTagAndPersist({ asset, db }).catch((err) =>
 *     console.warn("[auto-tagger] fire-and-forget failed:", err),
 *   );
 *
 * Note: db is typed as `any` here to avoid importing the Drizzle NeonHTTP
 * client type directly. The actual repository call is done via the shared
 * updateCreativeAssetSemanticTags function from @littlecolorbook/db.
 */
export async function autoTagAndPersist({
  asset,
  db,
}: {
  asset: {
    id: string;
    gcsBucket: string;
    gcsObject: string;
    mimeType: string;
    tagsJson?: Record<string, string>;
  };
  // Accepts the updateCreativeAssetSemanticTags function directly to avoid
  // circular package imports.
  db: {
    updateCreativeAssetSemanticTags: (input: {
      id: string;
      semanticTags: Record<string, unknown>;
      taggedAt: Date;
    }) => Promise<unknown>;
  };
}): Promise<{ assetId: string; tags: SemanticTags }> {
  // Fetch image from GCS
  const imageBuffer = await downloadObject({
    bucket: "exports",
    objectPath: asset.gcsObject,
  });

  // Run vision tagging
  const tags = await autoTagCreativeAsset({
    imageBuffer,
    mimeType: asset.mimeType,
    hintTags: asset.tagsJson as Record<string, string> | undefined,
  });

  // Persist
  await db.updateCreativeAssetSemanticTags({
    id: asset.id,
    semanticTags: tags as unknown as Record<string, unknown>,
    taggedAt: new Date(),
  });

  return { assetId: asset.id, tags };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserText(hintTags?: Record<string, string>): string {
  const lines = [
    "Please analyse this image and return the semantic tag JSON as described in your instructions.",
  ];
  if (hintTags && Object.keys(hintTags).length > 0) {
    lines.push(`Hint tags already known: ${JSON.stringify(hintTags)}`);
  }
  return lines.join("\n");
}

function parseTagsResponse(raw: string, model: string): SemanticTags {
  // Strip accidental markdown fences
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // First failure — try once more after stripping any leading/trailing
    // non-JSON characters (some models add a sentence before the object).
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn("[auto-tagger] Malformed JSON on retry — returning safe defaults");
        return safeDefaultTags(model);
      }
    } else {
      console.warn("[auto-tagger] Could not extract JSON from response — returning safe defaults");
      return safeDefaultTags(model);
    }
  }

  // Inject caller-side metadata fields before validation
  const withMeta = {
    ...(parsed as Record<string, unknown>),
    tagger_model: model,
    tagger_version: TAGGER_VERSION,
  };

  const result = SemanticTagsSchema.safeParse(withMeta);
  if (!result.success) {
    console.warn("[auto-tagger] Zod validation failed — returning safe defaults:", result.error.issues);
    return safeDefaultTags(model);
  }

  return result.data;
}
