#!/usr/bin/env node
// Download all GCS images for a prompt-eval run to a local tmp dir, so
// they can be inspected in-process. Writes a manifest.json mapping
// source_upload_id → { source, old_historical, new_flash_minimal, new_pro_minimal }
// local paths.
//
// Usage:
//   RUN_ID=eval-2026-04-21-local npx tsx --env-file=.env scripts/download-eval-run.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";

const RUN_ID = process.env.RUN_ID;
if (!RUN_ID) {
  console.error("RUN_ID env var is required.");
  process.exit(1);
}

const OUT_DIR = path.join("tmp", `eval-run-${RUN_ID}`);
const CONCURRENCY = Number.parseInt(process.env.DOWNLOAD_CONCURRENCY ?? "8", 10);

async function main() {
  const [{ downloadObject }, repo] = await Promise.all([
    import("@littlecolorbook/shared/storage"),
    import("@littlecolorbook/db/repositories"),
  ]);

  const samples = await repo.listPromptEvalSamples(RUN_ID);
  if (samples.length === 0) {
    console.error(`No samples found for run_id=${RUN_ID}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // Group by source
  const groups = new Map();
  for (const s of samples) {
    const list = groups.get(s.sourceUploadId) ?? { sourceObjectPath: s.sourceObjectPath, variants: {} };
    list.variants[s.variant] = {
      id: s.id,
      outputObjectPath: s.outputObjectPath,
      model: s.model,
    };
    groups.set(s.sourceUploadId, list);
  }

  console.log(`Run: ${RUN_ID}`);
  console.log(`Sources: ${groups.size}`);
  console.log(`Samples: ${samples.length}`);
  console.log(`Output:  ${OUT_DIR}\n`);

  const manifest = { runId: RUN_ID, sources: {} };
  const limit = pLimit(CONCURRENCY);

  const tasks = [];
  for (const [sourceId, group] of groups) {
    manifest.sources[sourceId] = {};
    const dir = path.join(OUT_DIR, sourceId);
    tasks.push(
      limit(async () => {
        await mkdir(dir, { recursive: true });

        // source
        try {
          const buf = await downloadObject({ bucket: "uploads", objectPath: group.sourceObjectPath });
          const ext = path.extname(group.sourceObjectPath) || ".jpg";
          const out = path.join(dir, `source${ext}`);
          await writeFile(out, buf);
          manifest.sources[sourceId].source = out;
        } catch (err) {
          console.error(`[${sourceId}] source failed: ${err.message ?? err}`);
        }

        // each variant
        for (const [variant, v] of Object.entries(group.variants)) {
          try {
            const buf = await downloadObject({ bucket: "uploads", objectPath: v.outputObjectPath });
            const ext = path.extname(v.outputObjectPath) || ".png";
            const out = path.join(dir, `${variant}${ext}`);
            await writeFile(out, buf);
            manifest.sources[sourceId][variant] = { path: out, id: v.id, model: v.model };
          } catch (err) {
            console.error(`[${sourceId}] ${variant} failed: ${err.message ?? err}`);
          }
        }
        process.stdout.write(".");
      }),
    );
  }

  await Promise.all(tasks);
  process.stdout.write("\n");

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Manifest: ${manifestPath}`);
  console.log(`✓ Downloaded ${groups.size} source groups, ${samples.length} variant rows`);
}

await main();
