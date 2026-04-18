#!/usr/bin/env node
/**
 * retag-creative-library.mjs
 *
 * Phase 7b — Backfill semantic tags for all hero_image creative_assets that
 * have not yet been auto-tagged (semantic_tagged_at IS NULL).
 *
 * Usage:
 *   node scripts/retag-creative-library.mjs [--limit N] [--dry-run]
 *
 * Required env:
 *   DATABASE_URL          — Neon/Postgres connection string
 *   ANTHROPIC_API_KEY     — Anthropic API key
 *   GCS_BUCKET_EXPORTS    — GCS exports bucket name (or GCS_EXPORTS_BUCKET)
 *   GCS credentials       — GCS_SERVICE_ACCOUNT_JSON_BASE64 OR
 *                           (GCS_PROJECT_ID + GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY)
 *
 * Optional env:
 *   ANTHROPIC_MODEL_VISION  — override vision model (default: claude-sonnet-4-5-20251022)
 *   RETAG_CONCURRENCY       — parallel workers (default 4, max 8)
 *   RETAG_KIND_FILTER       — asset kind filter (default: hero_image)
 *
 * Idempotent: rows with semantic_tagged_at already set are skipped.
 *
 * Cost estimate (50 heroes):
 *   ~1 200 input tok + ~300 output tok per image
 *   Sonnet: ~$3/MTok in + $15/MTok out
 *   Uncached: ~$0.0036 + ~$0.0045 = ~$0.008/image
 *   Cached sys-prompt (second+ call): ~$0.90/MTok in = ~$0.0011/image
 *   50 images uncached: ~$0.40
 *   50 images all-cached: ~$0.06
 */

import { config as loadEnv } from "dotenv";
loadEnv();

// ─── Validate required env ────────────────────────────────────────────────────

const REQUIRED = ["DATABASE_URL", "ANTHROPIC_API_KEY"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const LIMIT = limitArg ? parseInt(limitArg, 10) : 10_000;
const CONCURRENCY = Math.min(
  parseInt(process.env.RETAG_CONCURRENCY ?? "4", 10),
  8,
);
const KIND_FILTER = process.env.RETAG_KIND_FILTER ?? "hero_image";

// ─── Lazy imports ─────────────────────────────────────────────────────────────

const { neon } = await import("@neondatabase/serverless");
const { Storage } = await import("@google-cloud/storage");
const Anthropic = (await import("@anthropic-ai/sdk")).default;
const { z } = await import("zod");
const crypto = await import("node:crypto");

// ─── DB client ────────────────────────────────────────────────────────────────

const sqlClient = neon(process.env.DATABASE_URL);

// ─── GCS client ───────────────────────────────────────────────────────────────

function buildGcsCredentials() {
  const base64 = process.env.GCS_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64) {
    const decoded = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    return {
      projectId: decoded.project_id,
      clientEmail: decoded.client_email,
      privateKey: decoded.private_key,
    };
  }
  return {
    projectId: process.env.GCS_PROJECT_ID ?? process.env.GOOGLE_PROJECT_ID,
    clientEmail: process.env.GCS_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: (process.env.GCS_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  };
}

const gcsCreds = buildGcsCredentials();
const gcsStorage = new Storage({
  projectId: gcsCreds.projectId,
  credentials: {
    client_email: gcsCreds.clientEmail,
    private_key: gcsCreds.privateKey,
  },
});

const GCS_BUCKET = process.env.GCS_BUCKET_EXPORTS ?? process.env.GCS_EXPORTS_BUCKET ?? "littlecolorbook-exports";

async function downloadFromGcs(objectPath) {
  const bucket = gcsStorage.bucket(GCS_BUCKET);
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();
  return buffer;
}

// ─── Anthropic client + tagger ────────────────────────────────────────────────

const MODEL = process.env.ANTHROPIC_MODEL_VISION ?? "claude-sonnet-4-5-20251022";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TAGGER_VERSION = "2026-04-a-vision";

const SYSTEM_PROMPT = `You are a visual semantic tagger for "little color book", a brand that makes \
personalized coloring books from family photos. Analyse the provided image and return a rich \
JSON object describing its visual attributes.

Respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON. \
The object must match this schema:

{
  "scene_type": "indoor"|"outdoor"|"studio"|"vehicle"|"mixed"|"unknown",
  "setting": "home"|"park"|"beach"|"vacation"|"birthday"|"school"|"restaurant"|"other"|"unknown",
  "subject_types": array of: "family","couple","adult_solo","kid_solo","kids_group","toddler","baby","pet_dog","pet_cat","pet_other","object_only",
  "subject_count": integer 0-10,
  "props": array of: "toy","book","food","pet","gift","sports_equipment","musical_instrument","vehicle","screen","nature_object","none",
  "emotion": "joyful"|"calm"|"playful"|"serious"|"surprised"|"affectionate"|"neutral"|"unknown",
  "pose": "portrait"|"action"|"candid"|"posed"|"group_shot"|"unknown",
  "style": {
    "line_weight": "thin"|"medium"|"thick"|"mixed",
    "detail_level": "minimal"|"simple"|"medium"|"detailed",
    "background": "white"|"sparse"|"suggested"|"detailed",
    "subject_framing": "close_up"|"medium"|"wide"|"full_scene"
  },
  "complexity_score": integer 1-5 (1=very simple, 5=highly detailed),
  "child_recognition_risk": "low"|"medium"|"high"
}

Include only keys you are confident about. Do NOT include tagger_model or tagger_version.`;

// In-process SHA-256 cache: bufferHash → tags
const tagCache = new Map();

async function tagImage(buffer, mimeType) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (tagCache.has(hash)) {
    return { tags: tagCache.get(hash), fromCache: true };
  }

  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          {
            type: "text",
            text: "Please analyse this image and return the semantic tag JSON.",
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("No text content in response");
  }

  const cleaned = block.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Cannot parse JSON from response: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  const tags = {
    ...parsed,
    tagger_model: MODEL,
    tagger_version: TAGGER_VERSION,
  };

  tagCache.set(hash, tags);
  return { tags, fromCache: false };
}

// ─── Persist ──────────────────────────────────────────────────────────────────

async function persistTags(id, tags) {
  await sqlClient`
    UPDATE creative_assets
       SET semantic_tags      = ${JSON.stringify(tags)}::jsonb,
           semantic_tagged_at = now(),
           updated_at         = now()
     WHERE id = ${id}
  `;
}

// ─── Fetch untagged rows ──────────────────────────────────────────────────────

async function fetchUntagged(limit, kindFilter) {
  const rows = await sqlClient`
    SELECT id, gcs_bucket, gcs_object, mime_type, tags_json
      FROM creative_assets
     WHERE semantic_tagged_at IS NULL
       AND kind = ${kindFilter}
     ORDER BY created_at ASC
     LIMIT ${limit}
  `;
  return rows;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function renderProgress(done, total, errors) {
  const pct = total === 0 ? 100 : Math.floor((done / total) * 100);
  const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}%  ${done}/${total}  errors:${errors}   `);
}

// ─── Worker pool ──────────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  const queue = [...tasks];
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) results.push(await task());
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nPhase 7b — Semantic Retagger`);
console.log(`  Model    : ${MODEL}`);
console.log(`  Bucket   : ${GCS_BUCKET}`);
console.log(`  Kind     : ${KIND_FILTER}`);
console.log(`  Workers  : ${CONCURRENCY}`);
console.log(`  Limit    : ${LIMIT}`);
console.log(`  Dry run  : ${DRY_RUN}\n`);

const rows = await fetchUntagged(LIMIT, KIND_FILTER);
console.log(`  Found ${rows.length} untagged ${KIND_FILTER} assets\n`);

if (rows.length === 0) {
  console.log("  Nothing to do.\n");
  process.exit(0);
}

// Cost estimate
const costPerImage = 0.008; // ~$0.008 per image (uncached first call)
const estimatedCost = (rows.length * costPerImage).toFixed(2);
console.log(`  Estimated cost: ~$${estimatedCost} (${rows.length} × $${costPerImage}/image uncached)\n`);

if (DRY_RUN) {
  console.log("  --dry-run: no API calls or DB writes.\n");
  process.exit(0);
}

let done = 0;
let errors = 0;
let cacheHits = 0;

const tasks = rows.map((row) => async () => {
  try {
    const buffer = await downloadFromGcs(row.gcs_object);
    const mimeType = row.mime_type ?? "image/png";
    const { tags, fromCache } = await tagImage(buffer, mimeType);
    if (fromCache) cacheHits++;
    await persistTags(row.id, tags);
    done++;
    renderProgress(done, rows.length, errors);
    return { status: "ok", id: row.id };
  } catch (err) {
    errors++;
    process.stderr.write(`\n  ERR ${row.id}: ${err.message}\n`);
    renderProgress(done, rows.length, errors);
    return { status: "error", id: row.id, error: err.message };
  }
});

const results = await runWithConcurrency(tasks, CONCURRENCY);

console.log("\n");
console.log("─────────────────────────────────────────────────────");
console.log(`  Tagged successfully : ${done}`);
console.log(`  Cache hits          : ${cacheHits}`);
console.log(`  Errors              : ${errors}`);
console.log(`  Actual API calls    : ${done - cacheHits}`);
const actualCost = ((done - cacheHits) * costPerImage).toFixed(2);
console.log(`  Approx cost         : ~$${actualCost}`);
console.log("─────────────────────────────────────────────────────\n");

if (errors > 0) process.exit(1);
