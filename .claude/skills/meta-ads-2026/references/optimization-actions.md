# Optimization Actions

This is the catalog of actions Claude can take autonomously. Each action lists the **preconditions** that justify it and the **counter-indications** that rule it out. Match the diagnostic output from `performance-analysis.md` to an action here.

Actions are ordered roughly from least-to-most reversible. Prefer reversible actions when confidence is medium or low.

## pause_ad

Stop delivery of a single ad.

**Preconditions (any one):**
- Two or more quality rankings at Below Average
- Hook rate <20% after ≥500 impressions
- Ad-level CPA >2× ad set average CPA over ≥3 days
- Policy flag from Meta

**Counter-indications:**
- Ad is <72 hours old (insufficient data)
- Ad set is in learning phase and this ad is one of only 2–3 active ads (pausing starves the learning)

**Reversibility:** High. Can reactivate anytime.

**Action parameters:**
```json
{ "ad_ids": ["..."], "reason_code": "quality_below_average | hook_rate_fail | policy | underperform" }
```

## pause_ad_set

Stop delivery of an entire ad set.

**Preconditions (all):**
- All ads in the ad set meet individual pause criteria, OR
- Ad set CPA >2× target for ≥7 days, OR
- Ad set "exited learning limited" and refresh attempts have not fixed it

**Counter-indications:**
- Learning phase incomplete (<50 conversions, <7 days)
- Ad set is part of a structured A/B test and the sibling needs the control

**Reversibility:** High, but re-entering Learning when reactivated.

## refresh_creative

Pause fatigued creatives, introduce 3–5 new variants against the same offer.

**Preconditions (any two):**
- Frequency >2.0 weekly (prospecting) or >4.0 (retargeting)
- CTR velocity declined >20% over 3-day rolling window
- Hook rate dropped below 25% from a previously healthy state
- Quality ranking slipped one tier

**Counter-indications:**
- Ad set has <7 days of data (fatigue is a misdiagnosis in early learning)
- Creative pool already has 5+ active variants — refresh won't help if the problem is offer, not creative

**Reversibility:** Medium. New creatives enter learning; takes 3–7 days to see if they work.

**Action parameters:**
```json
{
  "ad_set_id": "...",
  "creatives_to_pause": ["..."],
  "new_variant_specs": {
    "count": 5,
    "offer": "unchanged",
    "hook_direction": "<specify direction — e.g. open with problem, open with customer quote>",
    "format_mix": ["UGC_video_9x16", "static_1x1"]
  }
}
```

See `creative-generation.md` for how to produce the new variants.

## scale_ad_set

Increase budget on a performing ad set.

**Preconditions (all):**
- Exited learning phase (≥50 conversions in past 7 days)
- CPA at or below target for ≥7 days
- ROAS at or above target for ≥7 days
- Frequency <2.0 weekly (room to grow before saturation)
- Quality ranking Average or better on all three dimensions

**Counter-indications:**
- Ad set scaled in past 72 hours
- Account-level CPM is rising >20% week-over-week (indicates saturated inventory; new budget will buy worse impressions)

**Scaling step:** Maximum **+20% budget per 72-hour window.** Never more. Larger jumps reset learning even on exited ad sets because CPM tier shifts.

**For vertical scale beyond +20%/72h:** use `duplicate_ad_set` instead — Meta treats duplicates as parallel explorations that don't reset the original's learning.

**Action parameters:**
```json
{ "ad_set_id": "...", "current_budget": 100, "new_budget": 120, "budget_type": "daily_budget" }
```

## duplicate_ad_set

Copy a performing ad set to scale horizontally or test a variable.

**Use when:**
- Want to scale spend faster than +20%/72h allows
- Testing a new audience, placement, or bid strategy without risking the original
- Original ad set saturated (frequency high) but still profitable — want to find fresh audience for the same creative

**Preconditions:** Original ad set has exited learning AND is performing at or above target.

**Action parameters:**
```json
{
  "source_ad_set_id": "...",
  "new_name": "<follow naming schema>",
  "variables_to_change": ["audience_expansion | placement_change | bid_strategy"],
  "initial_budget": "<start at 50% of original, let it learn before scaling>"
}
```

## change_bid_strategy

Move up or down the bidding ladder.

**Staged ladder (never skip stages):**
1. Highest Volume → Cost Cap (when >50 conversions/week and CPA stable)
2. Cost Cap → Bid Cap (only for flash sales or hard-margin periods)
3. Cost Cap → Minimum ROAS (profit-optimized e-commerce at scale)

**Preconditions for each transition:**
- Highest Volume → Cost Cap: ≥50 conversions in past 7 days, CPA variance <30%
- Cost Cap → Bid Cap: clear margin requirement, willing to accept under-delivery risk
- Cost Cap → Minimum ROAS: daily spend ≥$1,000, ROAS target well-understood from historical data

**Counter-indications:**
- In learning phase
- CPA or ROAS trending in wrong direction (fix that first; bid strategy won't rescue a losing ad set)

**Reversibility:** Medium. Changing bid strategy resets learning.

## expand_audience

Broaden the targeting — usually by removing detailed targeting constraints or switching to Advantage+ Audience.

**Preconditions:**
- Ad set showing signs of delivery throttle (low impressions relative to budget, rising CPM)
- Audience <1M for prospecting
- Frequency rising despite fresh creative (indicates audience exhaustion, not creative fatigue)

**Counter-indications:**
- Regulated vertical with legal audience restrictions
- B2B with tightly defined ICP where broadening wastes spend

## no_action

Don't touch the ad set. Most common when the ad set is performing within expectations or when data is insufficient.

**Use when:**
- All metrics within healthy ranges
- Ad set is in learning phase and changes would reset it
- Data is insufficient (return `rationale.primary_signal: "insufficient_data"` with re-review time)
- A recent action (budget change, creative refresh) is still settling — wait 72h

**This is a real decision, not a default.** Autonomous systems that always do *something* churn ad sets and destroy learning. Sometimes the best action is none.

## escalate

Return control to a human / higher-authority layer in the system. Use when:

- Tracking integrity is broken (EMQ <6.0, deduplication failing, CAPI not receiving events)
- Budget change >50% at campaign level warranted but risky
- Ad account, page, or domain flagged by Meta
- Signals conflict and no defensible decision is possible
- EU campaigns where DST fee hasn't been accounted for in the ROAS target
- Ad set spending >$500/day with zero conversions in learning phase (likely structural failure, not optimization problem)

When escalating, always specify in `rationale.primary_signal` what the escalation is *about* — the system routes escalations differently based on type.

## Action Decision Matrix

Quick-reference for common patterns:

| Pattern Observed                                       | Action                    |
|-------------------------------------------------------|---------------------------|
| CTR falling, frequency climbing, same offer           | `refresh_creative`        |
| CPA steady, ROAS climbing, frequency <2               | `scale_ad_set`            |
| CPA steady, ROAS climbing, frequency >2               | `duplicate_ad_set`        |
| Hook rate <20% on 3+ ads                              | `pause_ad` on worst, `refresh_creative` on rest |
| All ads Below Average quality                         | `pause_ad_set`, rebuild   |
| Conversions zero, spend >$300, 72h elapsed            | `pause_ad_set`            |
| EMQ <6.0 on purchase events                           | `escalate`                |
| Learning phase, metrics noisy                         | `no_action`               |
| Ad set exited learning, CPA 2× target                 | `refresh_creative` first, then reassess |
| Metrics conflict (high CTR + low CVR)                 | `no_action`, flag landing page |
