#!/usr/bin/env node
// Upsert a batch of scores from a JSON file into prompt_eval_samples.
// Usage:
//   SCORES_FILE=tmp/eval-run-eval-2026-04-21-local/scores.json npx tsx --env-file=.env scripts/submit-eval-scores.mjs

import { readFile } from "node:fs/promises";

const SCORES_FILE = process.env.SCORES_FILE;
if (!SCORES_FILE) {
  console.error("SCORES_FILE env var is required.");
  process.exit(1);
}

const raw = await readFile(SCORES_FILE, "utf8");
const rows = JSON.parse(raw);

const repo = await import("@littlecolorbook/db/repositories");

console.log(`Submitting ${rows.length} scores…`);
let ok = 0;
let fail = 0;
for (const row of rows) {
  try {
    const result = await repo.upsertPromptEvalScore({
      id: row.id,
      overallScore: row.overallScore ?? null,
      scoreDimensions: row.scoreDimensions ?? null,
      notes: row.notes ?? null,
      scoredBy: "claude-opus-4-7",
    });
    if (result) ok += 1;
    else fail += 1;
  } catch (err) {
    fail += 1;
    console.error(`✗ ${row.id}: ${err.message ?? err}`);
  }
}
console.log(`\n✓ Submitted ${ok}/${rows.length}  (${fail} failed)`);
