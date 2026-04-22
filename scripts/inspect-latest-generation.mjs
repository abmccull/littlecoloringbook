#!/usr/bin/env node
// One-off inspection of the most recent generation_pages rows.
// Usage: node --env-file=.env scripts/inspect-latest-generation.mjs

import { getSqlClient } from "./lib/migrate-runner.mjs";

const sql = getSqlClient();

const jobs = await sql.query(`
  SELECT
    gj.id         AS job_id,
    gj.order_id,
    gj.kind,
    gj.status,
    gj.target_pages,
    gj.provider,
    gj.model,
    gj.fallback_provider,
    gj.fallback_model,
    gj.accepted_page_count,
    gj.failed_page_count,
    gj.started_at,
    gj.completed_at,
    gj.created_at
  FROM generation_jobs gj
  ORDER BY gj.created_at DESC
  LIMIT 5
`);

console.log(`\nLatest ${jobs.length} generation_jobs:\n`);
for (const j of jobs) {
  console.log(JSON.stringify(j, null, 2));
  console.log("---");
}

const pages = await sql.query(`
  SELECT
    gp.id,
    gp.generation_job_id,
    gp.page_number,
    gp.status,
    gp.provider,
    gp.model,
    gp.prompt_version,
    gp.cleanup_version,
    gp.qa_score,
    gp.qa_flags,
    gp.qa_metrics,
    gp.render_attempts,
    gp.cost_cents,
    gp.asset_id,
    gp.created_at,
    gp.updated_at
  FROM generation_pages gp
  ORDER BY gp.created_at DESC
  LIMIT 10
`);

console.log(`\nLatest ${pages.length} generation_pages:\n`);
for (const p of pages) {
  console.log(JSON.stringify(p, null, 2));
  console.log("---");
}

const events = await sql.query(`
  SELECT
    event_type,
    details,
    created_at
  FROM order_events
  ORDER BY created_at DESC
  LIMIT 30
`);

console.log(`\nLatest ${events.length} order_events:\n`);
for (const e of events) {
  console.log(`[${e.created_at}] ${e.event_type}`);
  if (e.details) console.log("  ", JSON.stringify(e.details));
}
