#!/usr/bin/env node
// Generate prompt A/B eval samples.
//
// For each preserved source upload, renders the minimal prompt against
// Gemini 2.5 Flash and Gemini 3 Pro, uploads the outputs to GCS, and
// inserts `prompt_eval_samples` rows. If a matching historical
// `generated_page` asset exists (same order_id parsed from the GCS
// path), also inserts an `old_historical` row pointing at that existing
// blob.
//
// Requires tsx because it imports TS workspace packages directly.
//
// Usage:
//   npx tsx --env-file=.env scripts/generate-prompt-eval.mjs
//   RUN_ID=eval-2026-04-21-minimal npx tsx --env-file=.env scripts/generate-prompt-eval.mjs
//
// Idempotent: (run_id, source_upload_id, variant) unique index means
// re-runs skip rows already inserted.

import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";

const MODEL_FLASH = "gemini-2.5-flash-image";
const MODEL_PRO = "gemini-3-pro-image-preview";
const EVAL_SOURCES_DIR = "./tmp/eval-sources";

const RUN_ID =
  process.env.RUN_ID ??
  `eval-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString("hex")}`;

const CONCURRENCY = Number.parseInt(process.env.EVAL_CONCURRENCY ?? "4", 10);

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function extractOrderId(objectPath) {
  const match = objectPath.match(/(?:samples|orders)\/(ord_[a-f0-9]+)\//);
  return match?.[1] ?? null;
}

async function loadExtraSourcesFromDisk() {
  let entries;
  try {
    entries = await readdir(EVAL_SOURCES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const sources = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
    const filePath = path.join(EVAL_SOURCES_DIR, entry.name);
    const buffer = await readFile(filePath);
    const mimeType = entry.name.toLowerCase().endsWith(".png")
      ? "image/png"
      : entry.name.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    sources.push({
      id: `upl_disk_${crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16)}`,
      objectPath: `eval-sources-disk/${entry.name}`,
      mimeType,
      buffer,
      origin: "disk",
    });
  }
  return sources;
}

async function main() {
  const [
    { downloadObject, uploadObject },
    { buildColoringPromptMinimal, renderColoringPageOnce },
    repo,
  ] = await Promise.all([
    import("@littlecolorbook/shared/storage"),
    import("@littlecolorbook/pipeline"),
    import("@littlecolorbook/db/repositories"),
  ]);

  const {
    insertPromptEvalSample,
    listPreservedGeneratedAssets,
    listPreservedOriginalUploads,
  } = repo;

  const dbSources = await listPreservedOriginalUploads();
  const diskSources = await loadExtraSourcesFromDisk();
  const historicalAssets = await listPreservedGeneratedAssets();

  const historicalByOrder = new Map();
  for (const asset of historicalAssets) {
    const orderId = extractOrderId(asset.objectPath);
    if (orderId) historicalByOrder.set(orderId, asset);
  }

  const allSources = [
    ...dbSources.map((u) => ({
      id: u.id,
      objectPath: u.objectPath,
      mimeType: u.mimeType,
      buffer: null,
      origin: "db",
    })),
    ...diskSources,
  ];

  const prompt = buildColoringPromptMinimal();

  console.log(`\nRun:            ${RUN_ID}`);
  console.log(`Sources (db):   ${dbSources.length}`);
  console.log(`Sources (disk): ${diskSources.length}`);
  console.log(`Historical:     ${historicalAssets.length} preserved (${historicalByOrder.size} by order)`);
  console.log(`Concurrency:    ${CONCURRENCY}`);
  console.log(`Prompt:         ${prompt.length} chars\n${prompt}\n`);

  const limit = pLimit(CONCURRENCY);
  let rendered = 0;
  let historical = 0;
  let errors = 0;

  await Promise.all(
    allSources.map((source) =>
      limit(async () => {
        const label = source.objectPath.length > 60 ? `…${source.objectPath.slice(-57)}` : source.objectPath;
        console.log(`→ ${label}`);

        // Load source buffer (from disk or GCS)
        let sourceBuffer = source.buffer;
        if (!sourceBuffer) {
          try {
            sourceBuffer = await downloadObject({
              bucket: "uploads",
              objectPath: source.objectPath,
            });
          } catch (err) {
            console.error(`  ✗ download failed: ${err instanceof Error ? err.message : err}`);
            errors += 1;
            return;
          }
        }

        const orderIdHint = extractOrderId(source.objectPath);

        // old_historical row (pointer only, no render)
        if (orderIdHint && historicalByOrder.has(orderIdHint)) {
          const histAsset = historicalByOrder.get(orderIdHint);
          await insertPromptEvalSample({
            id: genId("pes"),
            runId: RUN_ID,
            sourceUploadId: source.id,
            sourceObjectPath: source.objectPath,
            orderIdHint,
            variant: "old_historical",
            model: "historical_unknown",
            promptText: null,
            outputObjectPath: histAsset.objectPath,
          });
          historical += 1;
          console.log(`  ✓ old_historical → ${histAsset.objectPath}`);
        }

        for (const [variant, model] of [
          ["new_flash_minimal", MODEL_FLASH],
          ["new_pro_minimal", MODEL_PRO],
        ]) {
          const outputObjectPath = `eval/${RUN_ID}/${source.id}/${variant}.png`;
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
              sourceUploadId: source.id,
              sourceObjectPath: source.objectPath,
              orderIdHint,
              variant,
              model,
              promptText: prompt,
              outputObjectPath,
            });
            rendered += 1;
            console.log(`  ✓ ${variant} (${model}) → ${outputObjectPath}`);
          } catch (err) {
            errors += 1;
            console.error(`  ✗ ${variant} failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }),
    ),
  );

  console.log(`\n── Summary ──`);
  console.log(`run_id:        ${RUN_ID}`);
  console.log(`sources:       ${allSources.length}`);
  console.log(`rendered new:  ${rendered}  (expected ${allSources.length * 2})`);
  console.log(`historical:    ${historical}  (expected ≤ ${allSources.length})`);
  console.log(`errors:        ${errors}`);
  if (errors > 0) process.exit(2);
}

await main();
