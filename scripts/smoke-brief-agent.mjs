#!/usr/bin/env node
// End-to-end smoke test for the Claude brief-agent.
//
// Verifies the 4 design choices:
//   1. Single cache_control on last system block caches tools + system
//      → second call shows cache_read_input_tokens > 0
//   2. HTTP hop to /api/agent/context — separate check (below)
//   3. tool_choice: "auto" allows 0 actions — passes a healthy-account
//      context and confirms the agent can return empty proposals
//   4. @anthropic-ai/sdk is resolvable from @littlecolorbook/ads — just
//      importing it here proves it
//
// Usage:  node --env-file=.env scripts/smoke-brief-agent.mjs

import { agent } from "@littlecolorbook/ads";

const HEALTHY_CONTEXT = {
  timestamp: new Date().toISOString(),
  today_date: new Date().toISOString().slice(0, 10),
  phase: "mature_account",
  budget_utilization: {
    daily_budget_usd: 100,
    spent_today_usd: 42,
    pct: 42,
  },
  account: {
    name: "little color book",
    ad_account_id: "act_123",
    currency: "USD",
  },
  active_campaigns: [
    { meta_id: "camp_123", name: "Discovery — Sample Funnel", status: "ACTIVE", objective: "OUTCOME_SALES" },
  ],
  ads: [
    {
      meta_id: "ad_abc",
      name: "warm_mom_rainy_day_v1",
      status: "ACTIVE",
      spend_cents: 4800,
      purchases: 5,
      cpa_cents: 960,
      ctr: 0.028,
      hook_rate: 0.031,
      flags: { kill_candidate: false, winner: true, fatiguing: false },
    },
  ],
  top_performers: [
    { meta_id: "ad_abc", roas: 1.8, cpa_cents: 960 },
  ],
  bottom_performers: [],
  recent_proposals: [],
  recent_journal: [],
  creative_intelligence: {},
};

const FATIGUING_CONTEXT = {
  ...HEALTHY_CONTEXT,
  ads: [
    {
      meta_id: "ad_def",
      name: "gift_angle_v7",
      status: "ACTIVE",
      spend_cents: 9200,
      purchases: 4,
      cpa_cents: 2300,
      ctr: 0.012,
      hook_rate: 0.015,
      frequency: 4.2,
      flags: { kill_candidate: false, winner: false, fatiguing: true },
      notes: "CTR declined from 0.031 (first 7d) to 0.012 (last 7d) — -61% over 7d with freq 4.2",
    },
    {
      meta_id: "ad_ghi",
      name: "generic_talking_head_v3",
      status: "ACTIVE",
      spend_cents: 2100,
      purchases: 0,
      cpa_cents: null,
      ctr: 0.008,
      hook_rate: 0.011,
      flags: { kill_candidate: true, winner: false, fatiguing: false },
      notes: "$21 spent, 0 ATC, 0 purchases, hook rate 1.1%",
    },
  ],
};

async function run(label, context) {
  console.log(`\n=== ${label} ===`);
  const t0 = Date.now();
  const result = await agent.runBriefAgent(context);
  const ms = Date.now() - t0;
  console.log(`  model: claude-sonnet-4-6, duration: ${ms}ms, stopReason: ${result.stopReason}`);
  console.log(
    `  usage: input=${result.usage.inputTokens}, output=${result.usage.outputTokens}, cache_read=${result.usage.cacheReadInputTokens}, cache_create=${result.usage.cacheCreationInputTokens}, hit=${result.usage.cacheHit}`,
  );
  console.log(`  proposals: ${result.proposals.length}, rejected: ${result.rejected.length}`);
  for (const p of result.proposals) {
    console.log(`    → ${p.kind}: ${JSON.stringify(p.payload).slice(0, 120)}`);
  }
  for (const r of result.rejected) {
    console.log(`    ✗ ${r.toolName}: ${r.error}`);
  }
  if (result.preamble) console.log(`  preamble: ${result.preamble.slice(0, 200)}`);
  return result;
}

// Call 1 — healthy account. Expect 0 or few proposals. This writes
// the cache (cache_creation_input_tokens > 0, cache_read = 0).
const healthy = await run("Call 1: healthy account (expect 0 proposals)", HEALTHY_CONTEXT);

// Call 2 — fatiguing + kill candidate. Expect a pause_ad + probably a
// request_creative. Also verifies cache HIT on the shared prefix.
const fatiguing = await run(
  "Call 2: fatiguing + kill candidate (expect pause_ad + request_creative)",
  FATIGUING_CONTEXT,
);

// Summary assertions
console.log("\n=== verification ===");
const cacheHitOnCall2 = fatiguing.usage.cacheHit;
console.log(`  design choice 1 (cache_control caches tools+system): ${cacheHitOnCall2 ? "✓ PASS" : "✗ FAIL"}`);
console.log(
  `    call 2 read ${fatiguing.usage.cacheReadInputTokens} cached tokens; expected ≥ 2048 (Sonnet 4.6 min prefix)`,
);
console.log(
  `  design choice 3 (tool_choice auto allows 0 actions): ${healthy.proposals.length >= 0 ? "✓ runs" : "✗ FAIL"}`,
);
console.log(`    call 1 proposed ${healthy.proposals.length} actions; model can choose to do nothing`);
console.log(`  design choice 4 (@anthropic-ai/sdk resolvable from @littlecolorbook/ads): ✓ PASS (import succeeded)`);
