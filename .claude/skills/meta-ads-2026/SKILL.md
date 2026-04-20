---
name: meta-ads-2026
description: Operational playbook for autonomous Meta Ads (Facebook/Instagram) campaign management via the Marketing API in 2026. Use whenever the calling system is creating campaigns, launching ads, pulling performance data, making optimization decisions (pause/scale/refresh/duplicate), generating ad creative, auditing tracking, or interpreting metrics. Covers the three-tier hierarchy, Advantage+ automation, Pixel + Conversions API (CAPI) and EMQ thresholds, Andromeda/GEM algorithm behavior, audience strategy, creative frameworks, the staged bidding ladder, attribution changes, and EU DST location fees. Trigger for any task involving the Meta Marketing API, Facebook/Instagram ad operations, performance diagnosis, or metric interpretation — even when the request doesn't name "Meta Ads" (e.g. "should I pause this ad set?", "CPA just doubled", "generate three ad variants"). Provides decision thresholds, diagnostic order, and structured output formats for autonomous decisions.
---

# Meta Ads 2026 — Operational Playbook

This skill governs autonomous Meta Ads decisions made via the Marketing API. The calling system asks Claude to create campaigns, analyze performance, make optimization decisions, or generate creative — and this skill provides the rules, thresholds, and output formats to do it consistently.

The skill is system-agnostic. It works for PlankMarket (B2B flooring marketplace), Little Color Book (consumer coloring book), and any other Meta Ads integration. Business-specific nuance comes from the calling system's context, not this skill.

## ⚠️ Little Color Book project override

**This is the Little Color Book copy of the skill.** Every decision made against the `littlecoloringbook` repo MUST also consult `references/little-color-book-context.md` before returning. That file contains:

- Real unit economics per SKU (not generic benchmarks)
- The pricing ladder currently in production
- Sample funnel rules (cold paid → /sample only, never /create)
- Campaign objective overrides (Leads for cold, Sales for retargeting)
- Weighted gross per acquired customer ($33.08 base mix)
- CPL / CAC targets + stop-loss conditions for the 50% reinvestment rule
- Pipeline capacity limits (don't scale past 80 orders/day without raising capacity first)
- Creator program overlay rules
- Escalate-immediately triggers specific to this business

**If `little-color-book-context.md` conflicts with any generic reference, the context file wins.** The generic files hold universal Meta Ads truth; the context file holds Little Color Book's current reality.

## Operating Premises

These premises shape every decision. Keep them front-of-mind on every task.

1. **Creative is the targeting mechanism.** Andromeda reads the creative and matches it to users. Before diagnosing a targeting problem, inspect the creative. Before recommending audience changes, consider creative refresh.

2. **CAPI is non-negotiable.** Pixel-only setups miss 40–60% of conversions. If EMQ is below threshold on conversion events, every downstream decision is operating on broken signal. Audit tracking *first* when anything looks wrong.

3. **Advantage+ is the default.** Detailed Targeting is a suggestion, not a constraint. For accounts with conversion history and ≥$50/day spend, Advantage+ Audience wins. Push back on over-restriction.

4. **Structure can't be fixed downstream.** Campaign objective mistakes cannot be corrected by better ads or better audiences. Audit structure before tuning.

5. **The Simple System is the default budget allocation:** 60% proven winners (consolidated Advantage+), 30% iterative variations, 10% pure experimentation. Deviate only with a reason.

## Task Routing

When the calling system hands Claude a task, identify the task type and consult the matching reference(s). Read the reference file before responding. When a task spans multiple domains (e.g., "analyze this ad set and decide what to do"), read the relevant references in parallel.

| Calling system task                                               | Read these references                                          |
|-------------------------------------------------------------------|----------------------------------------------------------------|
| Launch a new campaign / ad set / ad                               | `campaign-creation.md`, `marketing-api-operations.md`, `little-color-book-context.md` |
| Analyze performance of a campaign/ad set/ad                       | `performance-analysis.md`, `decision-thresholds.md`, `little-color-book-context.md` |
| Decide whether to pause / scale / refresh / duplicate             | `optimization-actions.md`, `decision-thresholds.md`, `little-color-book-context.md` |
| Generate ad copy or creative variations                           | `creative-generation.md`, `little-color-book-context.md`       |
| Audit or diagnose tracking / CAPI / EMQ                           | `tracking-capi-audit.md`, `decision-thresholds.md`, `little-color-book-context.md` |
| Execute Marketing API calls (bulk ops, rate limits, auth)         | `marketing-api-operations.md`                                  |
| Interpret EU-sensitive campaigns (audience in EU, DST fees)       | `eu-compliance.md`, `little-color-book-context.md`             |
| Understand *why* the algorithm is behaving a certain way          | `algorithm-context.md`                                         |
| Any decision about SKU pricing, upsell mix, CAC, or reinvestment  | `little-color-book-context.md` (authoritative on these)        |
| Creator partnership / whitelisted ad decisions                    | `little-color-book-context.md` §9, `tasks/creator-discovery-brief.md` |

`decision-thresholds.md` is the numerical reference used across almost every task. Always consult it when making a judgment call that depends on a benchmark. For Little Color Book, `little-color-book-context.md` provides project-specific thresholds that override the generic ones.

## Decision Output Format

When the calling system requests a decision, return a structured JSON object with reasoning. Use this shape for every decision (adapt fields as needed):

```json
{
  "decision": "pause_ad | scale_ad_set | refresh_creative | duplicate_audience | change_bid_strategy | launch_campaign | no_action | escalate",
  "target": {
    "level": "campaign | ad_set | ad",
    "id": "<Meta object id>",
    "name": "<object name if available>"
  },
  "confidence": "high | medium | low",
  "rationale": {
    "primary_signal": "<the metric or pattern driving the decision>",
    "supporting_signals": ["<metric/pattern>", "..."],
    "thresholds_referenced": ["<threshold name from decision-thresholds.md>"]
  },
  "action_parameters": {
    "<action-specific fields — e.g. new_budget, new_bid_cap, creative_ids_to_add>"
  },
  "risks": ["<what could go wrong with this decision>"],
  "next_review": "<when to re-evaluate — e.g. 72h, after_50_conversions>"
}
```

After the JSON, provide a brief natural-language summary (2–4 sentences) restating the decision and the single most important reason. The calling system logs both; the JSON is parsed for execution, the prose is for human audit trails.

## When to Act on Incomplete Data vs. Escalate

Autonomy is the default. But some decisions require more signal than the data provides. Use these rules:

**Act on incomplete data (default):**
- Routine optimization decisions where the worst case is reversible (pause, small budget change, creative rotation).
- Any decision where the reference threshold is clearly triggered, even if supporting signals are partial.
- Creative generation tasks (always produce variants; the system will test them).

**Escalate (return `decision: "escalate"` with reasoning):**
- Budget changes >50% at the campaign level.
- Spending >$500/day on a single ad set with no conversions in the learning phase (fewer than 50 conversions/week).
- CAPI/tracking appears broken (EMQ <6.0 on purchase events, or deduplication failing). Escalate because every other decision downstream is unreliable until tracking is fixed.
- Ad account, page, or domain appears restricted/limited (any Meta policy flag in the API response).
- Campaign targeting EU users without DST location fee accounted for in the ROAS calculation — flag so finance can reconcile.
- Any decision where the signal contradicts itself (e.g., high CTR + high frequency + rising CPA — ambiguous whether to scale or refresh).

**Never escalate for:**
- Standard optimization inside the Simple System (60/30/10).
- Refreshing creative when fatigue thresholds trigger.
- Pausing ads in Below Average quality tier.
- Routine API operations (authentication, rate limit handling, naming).

## Universal Pre-Action Checks

Before executing any decision that modifies the account, verify:

1. **Tracking is healthy.** EMQ ≥ 7.5 on conversion events. Deduplication confirmed. If not → escalate or fix tracking first.
2. **Learning phase status.** If the ad set has <50 conversions/week, it's still learning. Avoid changes that reset learning (major budget changes, bid strategy changes, audience edits) unless the ad set is clearly failing.
3. **The decision passes the "creative first" test.** If the proposed decision is an audience or bid change, confirm the creative isn't the actual problem first. See `performance-analysis.md`.
4. **Launch-paused protocol** for any new object. Create → QA → activate. Never create-and-activate in one API call. See `marketing-api-operations.md`.

## Minimum Data Requirements

Don't make optimization decisions on insufficient data:
- **Ad level:** need ≥3 days of delivery AND ≥1,000 impressions before any action beyond pausing for clear policy/quality issues.
- **Ad set level:** need ≥7 days AND ≥50 conversions (or equivalent signal for non-conversion objectives) before scaling or restructuring.
- **Campaign level:** need ≥14 days AND consistent ad set signals before objective or structural changes.

If the calling system asks for a decision before thresholds are met, return `decision: "no_action"` with `rationale.primary_signal: "insufficient_data"` and specify when to re-evaluate.

## Style Notes for Claude When Executing This Skill

- Lead every response with the decision or the answer. Do not restate the framework.
- Cite specific thresholds by value (e.g., "EMQ 7.2, below the 8.0 target") not vague descriptors.
- When metrics conflict, surface the conflict explicitly rather than averaging them into a muddled recommendation.
- Prefer reversible actions (pause, small budget step) over irreversible ones (delete, large scale) when confidence is medium or low.
- Use the naming schema from `marketing-api-operations.md` for every new object — machine-sortable naming is a prerequisite for the system's ability to reason about its own history.
