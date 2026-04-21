#!/usr/bin/env node
// One-time bootstrap: seeds the _lcb_migrations tracking table with
// every migration file currently on disk, assuming they have all been
// applied to the target database. Run this ONCE against the prod
// database when adopting the new migration CLI; after that, use
// migrate-apply for all future migrations.
//
// If the tracking table already has rows, this script is a no-op and
// refuses to overwrite them (safety).
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/migrate-bootstrap.mjs
//   node --env-file=.env scripts/migrate-bootstrap.mjs

import {
  TRACKING_TABLE,
  ensureTrackingTable,
  getAppliedMigrations,
  getSqlClient,
  listMigrationFiles,
  sha256OfMigrationFile,
  tagFromFilename,
  verifyCriticalColumns,
} from "./lib/migrate-runner.mjs";

const sql = getSqlClient();

await ensureTrackingTable(sql);

const existing = await getAppliedMigrations(sql);
if (existing.size > 0) {
  console.log(
    `${TRACKING_TABLE} already has ${existing.size} row(s). Bootstrap skipped — use migrate-apply from here on.`,
  );
  process.exit(0);
}

// Safety: refuse to bootstrap if critical columns are missing. That
// means the DB is NOT caught up, and bootstrapping would falsely
// record migrations as applied.
const missing = await verifyCriticalColumns(sql);
if (missing.length > 0) {
  console.error(`✗ Refusing to bootstrap. ${missing.length} critical column(s) missing:`);
  for (const c of missing) console.error(`  ${c.table}.${c.column}`);
  console.error("\nThis database is NOT caught up. Apply missing migrations manually first, then re-run bootstrap.");
  process.exit(2);
}

const files = await listMigrationFiles();
console.log(`Bootstrapping ${TRACKING_TABLE} with ${files.length} migration file(s)...`);

for (const filename of files) {
  const tag = tagFromFilename(filename);
  const sha = await sha256OfMigrationFile(filename);
  await sql.query(
    `INSERT INTO ${TRACKING_TABLE} (tag, sha256, duration_ms) VALUES ($1, $2, $3)`,
    [tag, sha, 0],
  );
  console.log(`  ✓ recorded ${tag}`);
}

console.log(`\n✓ Bootstrap complete. ${files.length} migration(s) recorded as applied.`);
console.log(`  Future migrations: add a new .sql file to packages/db/drizzle/ then run 'npm run db:migrate:apply'.`);
