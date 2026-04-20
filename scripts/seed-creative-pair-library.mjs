#!/usr/bin/env node
/**
 * Seed the creative library with existing vetted photo/coloring-page
 * PAIRS from the repo. Distinct from seed-creative-library.mjs which
 * seeds individual coloring pages from the FB-page warmup batch.
 *
 * This script preserves the source-photo ↔ coloring-page linkage so
 * the ad compositor can use the "before_after" variant without
 * calling Gemini.
 *
 * What it does:
 *  - Scans test-results/prompt-v2026-04-19d and
 *    test-results/prompt-v2026-04-19d-batch2/ for source.jpg +
 *    coloring.png pairs (the final v.d prompt outputs — 95% QC pass
 *    rate, already visually validated)
 *  - Uploads each pair to
 *    gs://<exports-bucket>/creative-library/seed/{id}/
 *  - Derives persona/audience tags from the filename convention
 *    (NN-family|kids|pets-*.jpg)
 *  - Writes brand/creative-seed-manifest.json — the index the
 *    creative-generation system reads when picking a pre-rendered
 *    hero for a new brief. Each entry has source + coloring URLs
 *    plus tags.
 *
 * Usage:
 *   node scripts/seed-creative-pair-library.mjs           # upload
 *   node scripts/seed-creative-pair-library.mjs --dry-run # preview
 *
 * Idempotent: re-uploading overwrites the object in place; the
 * manifest is regenerated from scratch each run.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { config as loadEnv } from "dotenv";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

const BATCH_DIRS = [
  "test-results/prompt-v2026-04-19d",
  "test-results/prompt-v2026-04-19d-batch2",
];
const MANIFEST_PATH = "brand/creative-seed-manifest.json";

const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;
const GCS_EXPORTS_BUCKET = process.env.GCS_EXPORTS_BUCKET || process.env.GCS_BUCKET_EXPORTS;
const GCS_CLIENT_EMAIL = process.env.GCS_CLIENT_EMAIL;
const GCS_PRIVATE_KEY = (process.env.GCS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

if (!DRY_RUN && (!GCS_PROJECT_ID || !GCS_EXPORTS_BUCKET || !GCS_CLIENT_EMAIL || !GCS_PRIVATE_KEY)) {
  console.error(
    "Missing GCS env vars. Need GCS_PROJECT_ID, GCS_EXPORTS_BUCKET (or GCS_BUCKET_EXPORTS), GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY.",
  );
  console.error("Run with --dry-run to preview without uploading.");
  process.exit(1);
}

const storage = DRY_RUN
  ? null
  : new Storage({
      projectId: GCS_PROJECT_ID,
      credentials: { client_email: GCS_CLIENT_EMAIL, private_key: GCS_PRIVATE_KEY },
    });

const bucket = DRY_RUN ? null : storage.bucket(GCS_EXPORTS_BUCKET);

function parseFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/^(\d+)-(family|kids|pets)-(.+)$/i);
  if (!match) return { index: null, persona: null, slug: base };
  return {
    index: Number(match[1]),
    persona: match[2].toLowerCase(),
    slug: match[3],
  };
}

function personaTagsFor(persona) {
  if (persona === "family") return { persona: "parent", audience_tag: "family_moments" };
  if (persona === "kids") return { persona: "parent", audience_tag: "kids_everyday" };
  if (persona === "pets") return { persona: "pet_parent", audience_tag: "pet_moments" };
  return { persona: "parent", audience_tag: "general" };
}

async function findPairs() {
  const pairs = [];
  for (const dir of BATCH_DIRS) {
    if (!existsSync(dir)) {
      console.warn(`Skipping missing directory: ${dir}`);
      continue;
    }
    const files = await readdir(dir);
    const bases = new Set();
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") continue;
      bases.add(path.basename(f, ext));
    }
    for (const base of bases) {
      const jpg = path.join(dir, `${base}.jpg`);
      const png = path.join(dir, `${base}.png`);
      if (existsSync(jpg) && existsSync(png)) {
        pairs.push({ sourcePath: jpg, coloringPath: png, batch: path.basename(dir), base });
      }
    }
  }
  return pairs;
}

async function uploadBuffer(objectPath, buffer, contentType) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would upload ${(buffer.length / 1024).toFixed(0)}kb → gs://${GCS_EXPORTS_BUCKET}/${objectPath}`);
    return;
  }
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
}

(async () => {
  console.log(`Scanning: ${BATCH_DIRS.join(", ")}`);
  const pairs = await findPairs();
  console.log(`Found ${pairs.length} source/coloring pairs.\n`);

  if (pairs.length === 0) {
    console.error("No pairs found — nothing to seed.");
    process.exit(1);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    bucket: GCS_EXPORTS_BUCKET ?? "(dry-run)",
    promptVersion: "2026-04-19.d",
    entries: [],
  };

  // Deduplicate across batches (batch2 wins since it's the fresher run).
  const seen = new Set();
  const orderedPairs = pairs
    .sort((a, b) => (a.batch > b.batch ? -1 : a.batch < b.batch ? 1 : 0))
    .filter((p) => {
      if (seen.has(p.base)) return false;
      seen.add(p.base);
      return true;
    });

  let i = 0;
  for (const pair of orderedPairs) {
    i++;
    const { persona, slug, index } = parseFilename(pair.base);
    const seedId = `${String(index ?? i).padStart(3, "0")}-${persona ?? "unknown"}-${slug}`.toLowerCase();
    const sourceObject = `creative-library/seed/${seedId}/source.jpg`;
    const coloringObject = `creative-library/seed/${seedId}/coloring.png`;

    console.log(`[${i}/${orderedPairs.length}] ${seedId}`);

    const [sourceBuf, coloringBuf] = await Promise.all([
      readFile(pair.sourcePath),
      readFile(pair.coloringPath),
    ]);

    await uploadBuffer(sourceObject, sourceBuf, "image/jpeg");
    await uploadBuffer(coloringObject, coloringBuf, "image/png");

    const tags = personaTagsFor(persona);

    manifest.entries.push({
      id: seedId,
      persona,
      sourceBatch: pair.batch,
      sourceObject,
      coloringObject,
      sourceUrl: `https://storage.googleapis.com/${GCS_EXPORTS_BUCKET}/${sourceObject}`,
      coloringUrl: `https://storage.googleapis.com/${GCS_EXPORTS_BUCKET}/${coloringObject}`,
      tags,
      sourceBytes: sourceBuf.length,
      coloringBytes: coloringBuf.length,
    });
  }

  if (!DRY_RUN) {
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nManifest → ${MANIFEST_PATH}`);
  } else {
    console.log(`\n[dry-run] would write manifest → ${MANIFEST_PATH} with ${manifest.entries.length} entries`);
  }

  console.log(`Done. ${manifest.entries.length} pairs ${DRY_RUN ? "would be" : "are"} seeded.`);
})().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
