#!/usr/bin/env node
/**
 * Apply migration 0028_processing_jobs.sql directly against the
 * DATABASE_URL. Skips drizzle-kit's interactive conflict prompts —
 * this migration is strictly additive (CREATE TYPE IF NOT EXISTS,
 * CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS) so
 * running it multiple times is safe.
 *
 * Usage:  node scripts/apply-migration-0028.mjs
 */

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const MIGRATION_PATH = "packages/db/drizzle/0028_processing_jobs.sql";

const sql = neon(DATABASE_URL);

(async () => {
  console.log(`Applying ${MIGRATION_PATH}...`);
  const sqlText = await readFile(MIGRATION_PATH, "utf8");

  // Split on semicolons at statement-ends. Strip line comments and
  // keep DO $$ BEGIN ... END $$ blocks intact.
  const statements = [];
  let buffer = "";
  let inDollarBlock = false;

  for (const line of sqlText.split(/\r?\n/)) {
    const trimmed = line.trim();
    // Skip pure line comments only when not in a block
    if (!inDollarBlock && trimmed.startsWith("--")) continue;

    // Detect DO $$ blocks
    if (/\bDO\s+\$\$/.test(line)) inDollarBlock = true;
    if (inDollarBlock && /END\s+\$\$\s*;/.test(line)) {
      buffer += line + "\n";
      statements.push(buffer.trim());
      buffer = "";
      inDollarBlock = false;
      continue;
    }

    buffer += line + "\n";

    if (!inDollarBlock && /;\s*$/.test(line)) {
      statements.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());

  const toRun = statements.filter((s) => s.length > 0);
  console.log(`Parsed ${toRun.length} SQL statements.`);

  for (let i = 0; i < toRun.length; i++) {
    const stmt = toRun[i];
    const preview = stmt.split("\n")[0].slice(0, 80);
    console.log(`\n[${i + 1}/${toRun.length}] ${preview}${stmt.length > 80 ? "..." : ""}`);
    try {
      await sql.query(stmt);
      console.log("  → OK");
    } catch (err) {
      console.error(`  → FAILED: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  console.log("\n✓ Migration 0028 applied. Verifying...");

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'processing_jobs'
  `;
  const enumCount = await sql`
    SELECT COUNT(*)::int AS n FROM pg_type
    WHERE typname IN ('processing_job_kind', 'processing_job_status')
  `;
  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'processing_jobs' ORDER BY indexname
  `;

  console.log("  processing_jobs table:", tables.length ? "✓ exists" : "✗ MISSING");
  console.log("  enums (expect 2):", enumCount[0]?.n ?? 0);
  console.log("  indexes:", indexes.map((r) => r.indexname).join(", "));
})().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
