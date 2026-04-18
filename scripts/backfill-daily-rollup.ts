#!/usr/bin/env -S tsx
/**
 * Backfills daily_metrics_rollup for the last N days (default 90).
 * Safe to re-run — recomputeDailyRollup is idempotent per day.
 *
 * Usage: npx tsx scripts/backfill-daily-rollup.ts [--days 90]
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });

function toDayIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { recomputeDailyRollup } = await import("../packages/db/src/index.ts");

  const flagIdx = process.argv.indexOf("--days");
  const days = flagIdx !== -1 ? Number(process.argv[flagIdx + 1]) : 90;
  if (!Number.isFinite(days) || days < 1 || days > 730) {
    console.error("--days must be between 1 and 730");
    process.exit(1);
  }

  const today = new Date();
  const dates: string[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(toDayIso(d));
  }

  console.log(`Backfilling ${dates.length} days of daily_metrics_rollup...`);

  let ok = 0, fail = 0;
  for (const day of dates) {
    try {
      await recomputeDailyRollup(day);
      ok++;
      if (ok % 10 === 0) console.log(`  ...${ok}/${dates.length}`);
    } catch (error) {
      fail++;
      console.error(`  ✗ ${day}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`✓ Backfilled ${ok} days (${fail} failed)`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
