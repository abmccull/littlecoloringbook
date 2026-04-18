#!/usr/bin/env -S tsx
/**
 * Reports Stripe webhook health: counts by status in the last 7 days,
 * and flags any events stuck in "received" (acknowledged but never
 * processed) — those are the interesting ones to investigate.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = neon(url);

  const byStatus = await sql`
    select status, count(*)::int as count
    from stripe_webhook_events
    where received_at > now() - interval '7 days'
    group by status
    order by count desc
  ` as Array<{ status: string; count: number }>;

  console.log("Stripe webhook events (last 7 days) by status:");
  for (const row of byStatus) {
    console.log(`  ${row.status.padEnd(14)} ${row.count}`);
  }
  if (byStatus.length === 0) {
    console.log("  (no events in window)");
  }

  const stuck = await sql`
    select stripe_event_id, type, received_at, status
    from stripe_webhook_events
    where status = 'received'
      and received_at < now() - interval '10 minutes'
    order by received_at desc
    limit 25
  ` as Array<{ stripe_event_id: string; type: string; received_at: string; status: string }>;

  console.log(`\nStuck events (status=received > 10min old): ${stuck.length}`);
  for (const row of stuck) {
    console.log(`  ${row.received_at} ${row.type} ${row.stripe_event_id}`);
  }

  const failed = await sql`
    select stripe_event_id, type, received_at, status
    from stripe_webhook_events
    where status = 'failed'
    order by received_at desc
    limit 10
  ` as Array<{ stripe_event_id: string; type: string; received_at: string; status: string }>;

  console.log(`\nRecent failed events: ${failed.length}`);
  for (const row of failed) {
    console.log(`  ${row.received_at} ${row.type} ${row.stripe_event_id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
