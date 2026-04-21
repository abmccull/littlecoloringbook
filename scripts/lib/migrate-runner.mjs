// Shared library for migration CLI scripts. Parses a .sql file into
// individual statements (preserving DO $$ ... END $$ blocks) and
// executes them one-by-one via the Neon HTTP driver. Records applied
// migrations in a `_lcb_migrations` tracking table so the CLI is
// idempotent across runs.

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

export const MIGRATIONS_DIR = "packages/db/drizzle";
export const TRACKING_TABLE = "_lcb_migrations";

export function getSqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Export it or run with --env-file=.env.");
    process.exit(1);
  }
  return neon(url);
}

export async function ensureTrackingTable(sql) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      tag text PRIMARY KEY,
      sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      duration_ms integer
    )
  `);
}

export async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .sort();
}

export function tagFromFilename(filename) {
  return filename.replace(/\.sql$/, "");
}

export async function getAppliedMigrations(sql) {
  const rows = await sql.query(`SELECT tag, sha256, applied_at FROM ${TRACKING_TABLE} ORDER BY tag`);
  const byTag = new Map();
  for (const row of rows) byTag.set(row.tag, row);
  return byTag;
}

// Parse a .sql file into executable statements. Line comments (--) are
// stripped outside DO $$ blocks; DO $$ BEGIN ... END $$ blocks are kept
// intact and treated as a single statement.
export function parseSqlStatements(sqlText) {
  const statements = [];
  let buffer = "";
  let inDollarBlock = false;

  for (const line of sqlText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!inDollarBlock && trimmed.startsWith("--")) continue;

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
  return statements.filter((s) => s.length > 0);
}

export async function applyMigration(sql, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const tag = tagFromFilename(filename);
  const sqlText = await readFile(filepath, "utf8");
  const sha = createHash("sha256").update(sqlText).digest("hex");
  const statements = parseSqlStatements(sqlText);

  console.log(`\nApplying ${tag} (${statements.length} statements, sha=${sha.slice(0, 12)})`);
  const startedAt = Date.now();
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.split("\n")[0].slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}${stmt.length > 80 ? "..." : ""} ... `);
    try {
      await sql.query(stmt);
      process.stdout.write("OK\n");
    } catch (err) {
      process.stdout.write("FAILED\n");
      throw new Error(
        `Migration ${tag} failed at statement ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  const durationMs = Date.now() - startedAt;

  await sql.query(
    `INSERT INTO ${TRACKING_TABLE} (tag, sha256, duration_ms) VALUES ($1, $2, $3)`,
    [tag, sha, durationMs],
  );

  console.log(`  ✓ recorded in ${TRACKING_TABLE} (${durationMs}ms)`);
  return { tag, sha, durationMs, statementCount: statements.length };
}

export async function sha256OfMigrationFile(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const buf = await readFile(filepath);
  return createHash("sha256").update(buf).digest("hex");
}

// Hardcoded list of critical columns the schema depends on. Used by
// migrate-verify to catch drift between schema.ts expectations and the
// live DB. Update this list when you add a column the app relies on
// being present — especially ones that break read paths if missing,
// as `occasion` and `feature_consent` did on 2026-04-20.
export const CRITICAL_COLUMNS = [
  { table: "orders", column: "occasion" },
  { table: "orders", column: "occasion_context" },
  { table: "orders", column: "feature_consent" },
  { table: "orders", column: "feature_consent_at" },
  { table: "orders", column: "feature_ingested_at" },
  { table: "orders", column: "client_ip" },
  { table: "customers", column: "feature_consent" },
  { table: "processing_jobs", column: "id" },
  { table: "creative_assets", column: "id" },
  { table: "ad_campaigns", column: "meta_id" },
  { table: "ad_daily_metrics", column: "entity_meta_id" },
  { table: "organic_posts", column: "status" },
  { table: "agent_proposals", column: "kind" },
];

export async function verifyCriticalColumns(sql) {
  const missing = [];
  for (const { table, column } of CRITICAL_COLUMNS) {
    const rows = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       LIMIT 1`,
      [table, column],
    );
    if (rows.length === 0) missing.push({ table, column });
  }
  return missing;
}
