#!/usr/bin/env node
// Apply any pending migrations in packages/db/drizzle/ to the database
// pointed at by DATABASE_URL. Idempotent — migrations already recorded
// in _lcb_migrations are skipped. Detects sha256 drift (a migration
// that was previously applied but has since been edited) and aborts.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/migrate-apply.mjs
//   # or with a .env file
//   node --env-file=.env scripts/migrate-apply.mjs

import {
  applyMigration,
  ensureTrackingTable,
  getAppliedMigrations,
  getSqlClient,
  listMigrationFiles,
  sha256OfMigrationFile,
  tagFromFilename,
} from "./lib/migrate-runner.mjs";

const sql = getSqlClient();

await ensureTrackingTable(sql);

const files = await listMigrationFiles();
const applied = await getAppliedMigrations(sql);

const pending = [];
const drifted = [];

for (const filename of files) {
  const tag = tagFromFilename(filename);
  const record = applied.get(tag);
  const sha = await sha256OfMigrationFile(filename);

  if (!record) {
    pending.push({ filename, tag, sha });
  } else if (record.sha256 !== sha) {
    drifted.push({ filename, tag, appliedSha: record.sha256, currentSha: sha });
  }
}

if (drifted.length > 0) {
  console.error("\n✗ sha256 drift detected — a previously-applied migration file has been edited:");
  for (const d of drifted) {
    console.error(`  ${d.tag}  applied=${d.appliedSha.slice(0, 12)}  file=${d.currentSha.slice(0, 12)}`);
  }
  console.error("\nDo NOT edit applied migrations. Create a new migration instead. Aborting.");
  process.exit(2);
}

if (pending.length === 0) {
  console.log(`✓ No pending migrations. ${applied.size} applied, ${files.length} on disk.`);
  process.exit(0);
}

console.log(`Found ${pending.length} pending migration(s):`);
for (const p of pending) console.log(`  - ${p.tag}`);

for (const { filename } of pending) {
  await applyMigration(sql, filename);
}

console.log(`\n✓ Applied ${pending.length} migration(s).`);
