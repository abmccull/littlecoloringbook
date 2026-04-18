#!/usr/bin/env node
// Seed the creative_assets table from the 50 warm-up coloring pages.
// Each PNG is uploaded to GCS as a hero image + 4 aspect crops.
// Idempotent: skips assets whose deterministic ID (hash of filename) already exists in DB.
//
// Usage: node scripts/seed-creative-library.mjs
// Requires: DATABASE_URL, GCS credentials (GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL,
//           GOOGLE_PRIVATE_KEY, GCS_EXPORTS_BUCKET) in .env

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv();

const IMAGES_DIR = "campaigns/fb-page-warmup/images";
const GCS_BUCKET = process.env.GCS_EXPORTS_BUCKET ?? process.env.EXPORTS_BUCKET ?? "littlecolorbook-exports";
const CONCURRENCY = 4;

// ─── Validate env ─────────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

if (!process.env.GOOGLE_PROJECT_ID && !process.env.GCS_PROJECT_ID) {
  console.error("Missing GOOGLE_PROJECT_ID in .env");
  process.exit(1);
}

// ─── Lazy imports (post-env load) ────────────────────────────────────────────

const { Storage } = await import("@google-cloud/storage");
const sharp = (await import("sharp")).default;
const { neon } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-http");
const { eq } = await import("drizzle-orm");

// ─── DB client ───────────────────────────────────────────────────────────────

const sql = neon(process.env.DATABASE_URL);
const db = drizzle({ client: sql });

// ─── GCS client ──────────────────────────────────────────────────────────────

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID ?? process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL ?? process.env.GCS_CLIENT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY ?? process.env.GCS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
});

const bucket = storage.bucket(GCS_BUCKET);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deterministic_id(filename) {
  return crypto.createHash("sha256").update(`warmup:${filename}`).digest("hex").slice(0, 26);
}

function inferCategory(filename) {
  const match = filename.match(/^\d+-([a-z]+)-/);
  return match ? match[1] : "unknown";
}

async function uploadBuffer(objectPath, buffer, mimeType = "image/png") {
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    resumable: false,
    metadata: { contentType: mimeType, cacheControl: "public, max-age=31536000" },
  });
}

async function deriveAndUploadCrops(heroBuffer, heroId) {
  const CROP_SPECS = {
    aspect_1x1: { width: 1080, height: 1080, strategy: "cover" },
    aspect_4x5: { width: 1080, height: 1350, strategy: "cover" },
    aspect_9x16: { width: 1080, height: 1920, strategy: "contain_white" },
    aspect_16x9: { width: 1920, height: 1080, strategy: "contain_white" },
  };

  const results = {};

  for (const [key, spec] of Object.entries(CROP_SPECS)) {
    let buf;

    if (spec.strategy === "cover") {
      buf = await sharp(heroBuffer)
        .resize({ width: spec.width, height: spec.height, fit: "cover", position: "centre" })
        .png({ compressionLevel: 7, quality: 85 })
        .toBuffer();
    } else {
      const fitted = await sharp(heroBuffer)
        .resize({ width: spec.width, height: spec.height, fit: "inside" })
        .png()
        .toBuffer();

      const meta = await sharp(fitted).metadata();
      const fw = meta.width ?? spec.width;
      const fh = meta.height ?? spec.height;
      const padLeft = Math.floor((spec.width - fw) / 2);
      const padTop = Math.floor((spec.height - fh) / 2);
      const padRight = spec.width - fw - padLeft;
      const padBottom = spec.height - fh - padTop;

      buf = await sharp(fitted)
        .extend({
          top: padTop, bottom: padBottom, left: padLeft, right: padRight,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .extend({
          top: 1, bottom: 1, left: 1, right: 1,
          background: { r: 240, g: 240, b: 240, alpha: 1 },
        })
        .resize({ width: spec.width, height: spec.height, fit: "cover", position: "centre" })
        .png({ compressionLevel: 7, quality: 85 })
        .toBuffer();
    }

    const objectPath = `creative-library/crops/${heroId}/${key}.png`;
    await uploadBuffer(objectPath, buf);
    results[key] = { objectPath, buffer: buf };
  }

  return results;
}

async function getImageDimensions(buffer) {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? null, height: meta.height ?? null };
}

async function assetExists(heroId) {
  // Use raw SQL to check — avoids importing full schema into a plain .mjs script.
  const rows = await sql`
    SELECT id FROM creative_assets WHERE id = ${heroId} LIMIT 1
  `;
  return rows.length > 0;
}

async function insertAsset({
  id, briefId, source, kind, parentAssetId, gcsBucket, gcsObject,
  mimeType, widthPx, heightPx, tagsJson, complianceStatus, consentSource,
}) {
  const now = new Date().toISOString();
  await sql`
    INSERT INTO creative_assets (
      id, brief_id, source, kind, parent_asset_id,
      gcs_bucket, gcs_object, mime_type,
      width_px, height_px, tags_json,
      compliance_status, compliance_checked_at,
      consent_source, created_at, updated_at
    ) VALUES (
      ${id}, ${briefId ?? null}, ${source}, ${kind}, ${parentAssetId ?? null},
      ${gcsBucket}, ${gcsObject}, ${mimeType},
      ${widthPx ?? null}, ${heightPx ?? null}, ${JSON.stringify(tagsJson)},
      ${complianceStatus}, ${now},
      ${consentSource ?? null}, ${now}, ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processOne(filename) {
  const heroId = deterministic_id(filename);
  const category = inferCategory(filename);

  // Idempotency check
  if (await assetExists(heroId)) {
    process.stdout.write(`  SKIP ${filename} (already seeded)\n`);
    return { status: "skipped" };
  }

  const filePath = path.join(IMAGES_DIR, filename);
  const heroBuffer = await readFile(filePath);
  const { width, height } = await getImageDimensions(heroBuffer);

  // Upload hero
  const heroObject = `creative-library/hero/${heroId}.png`;
  await uploadBuffer(heroObject, heroBuffer);

  // Derive + upload 4 crops
  const cropResults = await deriveAndUploadCrops(heroBuffer, heroId);

  const tagsJson = { audience_tag: category };

  // Insert hero row
  await insertAsset({
    id: heroId,
    briefId: null,
    source: "pipeline_test_batch",
    kind: "hero_image",
    parentAssetId: null,
    gcsBucket: GCS_BUCKET,
    gcsObject: heroObject,
    mimeType: "image/png",
    widthPx: width,
    heightPx: height,
    tagsJson,
    complianceStatus: "passed",
    consentSource: "internal",
  });

  // Insert 4 crop rows
  for (const [key, crop] of Object.entries(cropResults)) {
    const cropId = deterministic_id(`${filename}:${key}`);
    const cropMeta = await getImageDimensions(crop.buffer);
    await insertAsset({
      id: cropId,
      briefId: null,
      source: "pipeline_test_batch",
      kind: key,
      parentAssetId: heroId,
      gcsBucket: GCS_BUCKET,
      gcsObject: crop.objectPath,
      mimeType: "image/png",
      widthPx: cropMeta.width,
      heightPx: cropMeta.height,
      tagsJson,
      complianceStatus: "passed",
      consentSource: "internal",
    });
  }

  process.stdout.write(`  OK   ${filename} → hero:${heroId} category:${category}\n`);
  return { status: "inserted" };
}

async function runWithConcurrency(tasks, concurrency) {
  const queue = [...tasks];
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        results.push(await task());
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

const allFiles = (await readdir(IMAGES_DIR))
  .filter((f) => f.endsWith(".png") && !f.endsWith("manifest.json"));

console.log(`\nSeeding creative library from ${allFiles.length} warm-up PNGs\n`);
console.log(`Bucket: ${GCS_BUCKET}`);
console.log(`Concurrency: ${CONCURRENCY}\n`);

const tasks = allFiles.map((filename) => () => processOne(filename).catch((err) => {
  process.stderr.write(`  ERR  ${filename}: ${err.message}\n`);
  return { status: "error" };
}));

const results = await runWithConcurrency(tasks, CONCURRENCY);

const inserted = results.filter((r) => r.status === "inserted").length;
const skipped = results.filter((r) => r.status === "skipped").length;
const errors = results.filter((r) => r.status === "error").length;

console.log(`\n─────────────────────────────────────`);
console.log(`  Heroes inserted  : ${inserted}`);
console.log(`  Crops inserted   : ${inserted * 4}`);
console.log(`  Total rows       : ${inserted * 5}`);
console.log(`  Skipped          : ${skipped}`);
console.log(`  Errors           : ${errors}`);
console.log(`─────────────────────────────────────\n`);

if (errors > 0) process.exit(1);
