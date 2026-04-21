#!/usr/bin/env node
// Read-only audit of the deployed email sequence system.
// Pulls enrollment counts, send outcomes, and trigger diagnostics from
// production Neon so we can verify the sequences are doing what their
// templates promise. No writes, no sends.
//
// Usage:  node --env-file=.env scripts/audit-email-sequences.mjs

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const sql = neon(url);

const now = new Date();
const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

console.log(`# Email sequences audit — ${now.toISOString()}`);
console.log(`(window: ${d30.toISOString()} → now, 30d)\n`);

// ── 1. Enrollment state by sequence ─────────────────────────────────────────
console.log("## 1. Sequence enrollments (all-time, all statuses)\n");
const enrollments = await sql.query(`
  SELECT sequence, status, COUNT(*) AS n
  FROM email_sequence_states
  GROUP BY sequence, status
  ORDER BY sequence, status
`);
if (enrollments.length === 0) {
  console.log("  (no rows in email_sequence_states — no one has ever been enrolled)\n");
} else {
  console.log("  sequence          | status      | count");
  console.log("  ------------------|-------------|------");
  for (const r of enrollments) {
    console.log(`  ${String(r.sequence).padEnd(17)} | ${String(r.status).padEnd(11)} | ${r.n}`);
  }
  console.log("");
}

// ── 2. Enrollments enrolled in last 30 days ─────────────────────────────────
console.log("## 2. New enrollments, last 30d\n");
const recentEnrollments = await sql.query(`
  SELECT sequence, COUNT(*) AS n
  FROM email_sequence_states
  WHERE enrolled_at >= $1
  GROUP BY sequence
  ORDER BY n DESC
`, [d30.toISOString()]);
if (recentEnrollments.length === 0) {
  console.log("  (no enrollments in last 30d — triggers may be disabled or broken)\n");
} else {
  for (const r of recentEnrollments) {
    console.log(`  ${String(r.sequence).padEnd(17)} | ${r.n}`);
  }
  console.log("");
}

// ── 3. Send outcomes by sequence + status ───────────────────────────────────
console.log("## 3. Sends by sequence + status, last 30d\n");
const sends = await sql.query(`
  SELECT sequence, status, COUNT(*) AS n
  FROM email_sends
  WHERE created_at >= $1
  GROUP BY sequence, status
  ORDER BY sequence, status
`, [d30.toISOString()]);
if (sends.length === 0) {
  console.log("  (no sends in last 30d)\n");
} else {
  console.log("  sequence          | status      | count");
  console.log("  ------------------|-------------|------");
  for (const r of sends) {
    console.log(`  ${String(r.sequence ?? "(none)").padEnd(17)} | ${String(r.status).padEnd(11)} | ${r.n}`);
  }
  console.log("");
}

// ── 4. Sends per sequence+step (which steps actually fire) ──────────────────
console.log("## 4. Sends by sequence + step (last 30d, sent+queued only)\n");
const bySteps = await sql.query(`
  SELECT sequence, step, status, COUNT(*) AS n
  FROM email_sends
  WHERE created_at >= $1 AND sequence IS NOT NULL
  GROUP BY sequence, step, status
  ORDER BY sequence, step, status
`, [d30.toISOString()]);
if (bySteps.length === 0) {
  console.log("  (no sequenced sends in last 30d)\n");
} else {
  console.log("  sequence          | step | status      | count");
  console.log("  ------------------|------|-------------|------");
  for (const r of bySteps) {
    console.log(
      `  ${String(r.sequence).padEnd(17)} | ${String(r.step).padStart(4)} | ${String(r.status).padEnd(11)} | ${r.n}`,
    );
  }
  console.log("");
}

// ── 5. Failure sample (last 10 failed sends) ────────────────────────────────
console.log("## 5. Recent send failures (last 10)\n");
const failures = await sql.query(`
  SELECT sequence, step, template, to_email, status, error, created_at
  FROM email_sends
  WHERE status IN ('failed', 'error', 'bounced')
  ORDER BY created_at DESC
  LIMIT 10
`);
if (failures.length === 0) {
  console.log("  (no recent failures)\n");
} else {
  for (const r of failures) {
    const err = (r.error ?? "").slice(0, 80);
    console.log(
      `  ${new Date(r.created_at).toISOString().slice(0, 19)}  ${r.sequence ?? "-"}/${r.step ?? "-"}  ${r.to_email}  ${r.status}  ${err}`,
    );
  }
  console.log("");
}

// ── 6. Diagnostic: customers enrolled in welcome vs customers with a sample ─
console.log("## 6. Trigger coverage — customers with sample vs enrolled in welcome\n");
const triggerCoverage = await sql.query(`
  SELECT
    COUNT(DISTINCT o.customer_id) FILTER (WHERE o.order_type = 'sample') AS sample_customers,
    COUNT(DISTINCT s.customer_id) FILTER (WHERE s.sequence = 'welcome') AS welcome_enrolled
  FROM orders o
  FULL OUTER JOIN email_sequence_states s ON s.customer_id = o.customer_id
`);
console.log(`  customers with any sample order : ${triggerCoverage[0]?.sample_customers ?? 0}`);
console.log(`  customers enrolled in 'welcome' : ${triggerCoverage[0]?.welcome_enrolled ?? 0}`);
console.log("");

// ── 7. Abandonment specifically — draft orders that sit > 1hr unpaid ───────
console.log("## 7. Abandonment eligibility vs enrollment\n");
const draftOrdersOver1h = await sql.query(`
  SELECT COUNT(*) AS n
  FROM orders
  WHERE status = 'draft'
    AND created_at < now() - interval '1 hour'
    AND created_at >= $1
    AND order_type <> 'sample'
`, [d30.toISOString()]);

const abandonmentEnrolled = await sql.query(`
  SELECT COUNT(*) AS n
  FROM email_sequence_states
  WHERE sequence = 'abandonment'
    AND enrolled_at >= $1
`, [d30.toISOString()]);

console.log(`  draft non-sample orders >1h old (30d): ${draftOrdersOver1h[0]?.n ?? 0}`);
console.log(`  abandonment enrollments (30d)        : ${abandonmentEnrolled[0]?.n ?? 0}`);
if ((draftOrdersOver1h[0]?.n ?? 0) > 0 && (abandonmentEnrolled[0]?.n ?? 0) === 0) {
  console.log("  ⚠ eligible orders exist but no enrollments — abandonment trigger may not be wired");
}
console.log("");

// ── 8. Re-engagement eligibility ────────────────────────────────────────────
console.log("## 8. Re-engagement eligibility vs enrollment\n");
const inactive30d = await sql.query(`
  SELECT COUNT(DISTINCT o.customer_id) AS n
  FROM orders o
  WHERE o.status = 'paid'
    AND o.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.customer_id = o.customer_id
        AND o2.status = 'paid'
        AND o2.created_at >= now() - interval '30 days'
    )
`);
const reEngagementEnrolled = await sql.query(`
  SELECT COUNT(*) AS n FROM email_sequence_states
  WHERE sequence = 're_engagement' AND enrolled_at >= $1
`, [d30.toISOString()]);
console.log(`  customers whose last paid order is >30d old : ${inactive30d[0]?.n ?? 0}`);
console.log(`  re_engagement enrollments (30d)             : ${reEngagementEnrolled[0]?.n ?? 0}`);
console.log("");

// ── 9. Welcome enrollment trigger timing ────────────────────────────────────
console.log("## 9. Sample-to-welcome-enrollment latency\n");
const enrollTiming = await sql.query(`
  SELECT
    MIN(EXTRACT(EPOCH FROM (s.enrolled_at - o.created_at))) AS min_seconds,
    AVG(EXTRACT(EPOCH FROM (s.enrolled_at - o.created_at)))::int AS avg_seconds,
    MAX(EXTRACT(EPOCH FROM (s.enrolled_at - o.created_at))) AS max_seconds,
    COUNT(*) AS pairs
  FROM email_sequence_states s
  JOIN orders o ON o.customer_id = s.customer_id
  WHERE s.sequence = 'welcome'
    AND o.order_type = 'sample'
    AND s.enrolled_at >= o.created_at
    AND s.enrolled_at >= $1
`, [d30.toISOString()]);
if ((enrollTiming[0]?.pairs ?? 0) === 0) {
  console.log("  (no matched sample→welcome pairs in 30d)\n");
} else {
  const r = enrollTiming[0];
  console.log(`  pairs       : ${r.pairs}`);
  console.log(`  min latency : ${Math.round(r.min_seconds)}s`);
  console.log(`  avg latency : ${r.avg_seconds}s`);
  console.log(`  max latency : ${Math.round(r.max_seconds)}s`);
  if (r.max_seconds > 3600) console.log("  ⚠ max > 1h — check enrollment trigger is firing synchronously");
  console.log("");
}

console.log("## done.\n");
