#!/usr/bin/env node
// Verify that all migration files are applied and that critical columns
// exist on the database. Intended to run before every production
// deploy as a pre-flight. Exit codes:
//   0 — clean
//   1 — pending migrations (ran `migrate-apply` to fix)
//   2 — drift (sha mismatch, missing critical columns, or tracking
//       table out of sync)
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/migrate-verify.mjs
//   node --env-file=.env scripts/migrate-verify.mjs

import {
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

const files = await listMigrationFiles();
const applied = await getAppliedMigrations(sql);

const pending = [];
const drifted = [];
const orphaned = [];

for (const filename of files) {
  const tag = tagFromFilename(filename);
  const record = applied.get(tag);
  const sha = await sha256OfMigrationFile(filename);

  if (!record) {
    pending.push({ tag, sha });
  } else if (record.sha256 !== sha) {
    drifted.push({ tag, appliedSha: record.sha256, currentSha: sha });
  }
}

for (const tag of applied.keys()) {
  if (!files.some((f) => tagFromFilename(f) === tag)) {
    orphaned.push(tag);
  }
}

const missingColumns = await verifyCriticalColumns(sql);

let exitCode = 0;

console.log(`Migrations: ${files.length} on disk, ${applied.size} recorded as applied.`);

if (pending.length > 0) {
  exitCode = Math.max(exitCode, 1);
  console.log(`\n⚠ ${pending.length} pending migration(s) — run 'npm run db:migrate:apply':`);
  for (const p of pending) console.log(`  - ${p.tag}`);
}

if (drifted.length > 0) {
  exitCode = 2;
  console.error(`\n✗ ${drifted.length} migration(s) have sha256 drift (file edited after apply):`);
  for (const d of drifted) {
    console.error(`  ${d.tag}  applied=${d.appliedSha.slice(0, 12)}  file=${d.currentSha.slice(0, 12)}`);
  }
}

if (orphaned.length > 0) {
  exitCode = 2;
  console.error(`\n✗ ${orphaned.length} orphaned tracking entry (recorded but no file):`);
  for (const t of orphaned) console.error(`  ${t}`);
}

if (missingColumns.length > 0) {
  exitCode = 2;
  console.error(`\n✗ ${missingColumns.length} critical column(s) missing from the database:`);
  for (const c of missingColumns) console.error(`  ${c.table}.${c.column}`);
}

if (exitCode === 0) {
  console.log(`\n✓ Schema verified. All ${files.length} migrations applied, all critical columns present.`);
} else if (exitCode === 1) {
  console.log(`\n→ Run 'npm run db:migrate:apply' to apply pending migrations, then re-verify.`);
} else {
  console.error(`\n✗ Drift detected. Investigate before deploying.`);
}

process.exit(exitCode);
