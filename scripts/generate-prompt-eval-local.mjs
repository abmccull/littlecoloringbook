#!/usr/bin/env node
// Generate prompt A/B eval samples from the LOCAL marketing photo library.
//
// Source photos:    marketing/assets/website-proof-photo-library/images/*.jpg
// Old-prompt PNGs:  test-results/prompt-v2026-04-19*/  (matched by stem;
//                   newest batch wins)
//
// For each source:
//  - upload source JPG to eval/<run>/<sample>/source.jpg
//  - if an old-prompt PNG exists, upload it to eval/<run>/<sample>/old_historical.png
//    and insert an old_historical row
//  - render new_flash_minimal (Gemini 2.5 Flash + minimal prompt), upload, insert
//  - render new_pro_minimal (Gemini 3 Pro + minimal prompt), upload, insert
//
// Idempotent via the (run_id, source_upload_id, variant) unique index.
//
// Usage:
//   RUN_ID=eval-2026-04-21-local npx tsx --env-file=.env scripts/generate-prompt-eval-local.mjs

import crypto from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";

const MODEL_FLASH = "gemini-2.5-flash-image";
const MODEL_PRO = "gemini-3-pro-image-preview";

const SOURCES_DIR = "marketing/assets/website-proof-photo-library/images";
const TEST_RESULTS_DIR = "test-results";

// Newest-to-oldest so the first match wins
const OLD_BATCH_PREFERENCE = [
  "prompt-v2026-04-19d-batch2",
  "prompt-v2026-04-19d",
  "prompt-v2026-04-19c",
  "prompt-v2026-04-19b",
  "prompt-v2026-04-19",
];

const RUN_ID =
  process.env.RUN_ID ??
  `eval-${new Date().toISOString().slice(0, 10)}-local-${crypto.randomBytes(3).toString("hex")}`;

const CONCURRENCY = Number.parseInt(process.env.EVAL_CONCURRENCY ?? "4", 10);

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function deterministicSampleId(stem) {
  const hash = crypto.createHash("sha256").update(stem).digest("hex").slice(0, 16);
  return `upl_local_${hash}`;
}

async function listSources() {
  const entries = await readdir(SOURCES_DIR, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (!/\.(jpe?g|png|webp)$/.test(lower)) continue;
    const stem = entry.name.replace(/\.[^.]+$/, "");
    out.push({
      stem,
      fileName: entry.name,
      absPath: path.join(SOURCES_DIR, entry.name),
      mimeType: lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg",
    });
  }
  return out.sort((a, b) => a.stem.localeCompare(b.stem));
}

async function buildOldPromptMap() {
  const map = new Map();
  for (const batch of OLD_BATCH_PREFERENCE) {
    const dir = path.join(TEST_RESULTS_DIR, batch);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".png")) continue;
      const stem = entry.name.replace(/\.png$/i, "");
      if (!map.has(stem)) {
        map.set(stem, {
          batch,
          absPath: path.join(dir, entry.name),
        });
      }
    }
  }
  return map;
}

async function main() {
  const [{ uploadObject }, { buildColoringPromptMinimal, renderColoringPageOnce }, repo] =
    await Promise.all([
      import("@littlecolorbook/shared/storage"),
      import("@littlecolorbook/pipeline"),
      import("@littlecolorbook/db/repositories"),
    ]);
  const { insertPromptEvalSample } = repo;

  const sources = await listSources();
  const oldPromptMap = await buildOldPromptMap();
  const prompt = buildColoringPromptMinimal();

  console.log(`\nRun:            ${RUN_ID}`);
  console.log(`Sources dir:    ${SOURCES_DIR}`);
  console.log(`Sources found:  ${sources.length}`);
  console.log(`Old-prompt map: ${oldPromptMap.size} stems matched`);
  console.log(`Concurrency:    ${CONCURRENCY}`);
  console.log(`Prompt:         ${prompt.length} chars\n${prompt}\n`);

  if (sources.length === 0) {
    console.error("No sources found. Is the directory correct?");
    process.exit(1);
  }

  const limit = pLimit(CONCURRENCY);
  let sourcesUploaded = 0;
  let historical = 0;
  let rendered = 0;
  let errors = 0;

  await Promise.all(
    sources.map((source) =>
      limit(async () => {
        const sampleId = deterministicSampleId(source.stem);
        const sourceBuffer = await readFile(source.absPath);
        const label = source.stem.length > 40 ? source.stem.slice(0, 37) + "…" : source.stem;
        console.log(`→ ${label}`);

        // Upload source to GCS
        const sourceObjectPath = `eval/${RUN_ID}/${sampleId}/source.${source.fileName.split(".").pop()}`;
        try {
          await uploadObject({
            bucket: "uploads",
            objectPath: sourceObjectPath,
            body: sourceBuffer,
            contentType: source.mimeType,
          });
          sourcesUploaded += 1;
        } catch (err) {
          errors += 1;
          console.error(`  ✗ source upload failed: ${err instanceof Error ? err.message : err}`);
          return;
        }

        // old_historical
        const oldMatch = oldPromptMap.get(source.stem);
        if (oldMatch) {
          try {
            const oldBuffer = await readFile(oldMatch.absPath);
            const oldPath = `eval/${RUN_ID}/${sampleId}/old_historical.png`;
            await uploadObject({
              bucket: "uploads",
              objectPath: oldPath,
              body: oldBuffer,
              contentType: "image/png",
            });
            await insertPromptEvalSample({
              id: genId("pes"),
              runId: RUN_ID,
              sourceUploadId: sampleId,
              sourceObjectPath,
              orderIdHint: null,
              variant: "old_historical",
              model: "prompt-2026-04-19.d",
              promptText: null,
              outputObjectPath: oldPath,
              notes: `batch=${oldMatch.batch}`,
            });
            historical += 1;
            console.log(`  ✓ old_historical (from ${oldMatch.batch})`);
          } catch (err) {
            errors += 1;
            console.error(`  ✗ old_historical failed: ${err instanceof Error ? err.message : err}`);
          }
        } else {
          console.log(`  · no old-prompt match for stem ${source.stem}`);
        }

        for (const [variant, model] of [
          ["new_flash_minimal", MODEL_FLASH],
          ["new_pro_minimal", MODEL_PRO],
        ]) {
          const outputObjectPath = `eval/${RUN_ID}/${sampleId}/${variant}.png`;
          try {
            const result = await renderColoringPageOnce({
              mimeType: source.mimeType,
              model,
              prompt,
              sourceBuffer,
            });
            await uploadObject({
              bucket: "uploads",
              objectPath: outputObjectPath,
              body: result.buffer,
              contentType: result.mimeType,
            });
            await insertPromptEvalSample({
              id: genId("pes"),
              runId: RUN_ID,
              sourceUploadId: sampleId,
              sourceObjectPath,
              orderIdHint: null,
              variant,
              model,
              promptText: prompt,
              outputObjectPath,
            });
            rendered += 1;
            console.log(`  ✓ ${variant} (${model})`);
          } catch (err) {
            errors += 1;
            console.error(`  ✗ ${variant} failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }),
    ),
  );

  console.log(`\n── Summary ──`);
  console.log(`run_id:           ${RUN_ID}`);
  console.log(`sources:          ${sources.length}`);
  console.log(`sources uploaded: ${sourcesUploaded}`);
  console.log(`old_historical:   ${historical}  (expected ≤ ${sources.length})`);
  console.log(`rendered new:     ${rendered}  (expected ${sources.length * 2})`);
  console.log(`errors:           ${errors}`);
  if (errors > 0) process.exit(2);
}

await main();
