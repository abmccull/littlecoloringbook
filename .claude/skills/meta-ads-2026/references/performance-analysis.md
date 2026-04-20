# Performance Analysis

When the calling system asks Claude to analyze an ad set or ad, follow this diagnostic order. The order matters: each step rules out upstream causes before examining downstream ones. Jumping to "refresh creative" when the real problem is broken tracking wastes money and produces misleading learnings.

## The Five-Layer Diagnostic Order

Always check in this sequence:

1. **Signal integrity** — is tracking healthy?
2. **Structure** — is the campaign configured correctly?
3. **Creative** — is the ad fatigued or poorly matched?
4. **Audience** — is the algorithm finding the right users?
5. **Bid & budget** — is the pricing strategy right for the state?

Do not skip to layer 3 before verifying layers 1 and 2. A fatigued creative diagnosis is only meaningful if the signal reaching Meta is clean and the campaign structure is sound.

## Layer 1: Signal Integrity

Before interpreting any metric, verify:

- **EMQ on conversion events is ≥ 7.5** (target 8.0–9.3). Below this, the algorithm is optimizing on degraded signal.
- **CAPI events match Pixel events** (no more than ~10% drift; CAPI should see equal or greater volume due to server-side resilience).
- **Event deduplication is clean.** Any duplicate alerts in Events Manager invalidate the conversion counts.
- **Domain is verified** and AEM priority is set for the intended conversion event.

If any of these fail, the analysis stops here. Return `decision: "escalate"` with `rationale.primary_signal: "tracking_integrity_failure"`. No downstream diagnosis is meaningful until tracking is fixed.

See `tracking-capi-audit.md` for the diagnostic tree.

## Layer 2: Structure

Check that the campaign structure is serving the business goal:

- **Objective alignment:** Is the campaign objective the right one for what the business actually wants? A "Traffic" campaign will never efficiently produce purchases no matter how good the creative is.
- **Audience overlap:** If multiple active ad sets target overlapping audiences, they bid against each other. Check via the Audience Overlap tool (>20% overlap is meaningful).
- **Learning phase state:** Is the ad set still in Learning? If <50 conversions/week, most optimization decisions are premature.
- **Budget adequacy:** Does the budget support ≥50 conversions/week at the current CPA? If not, the ad set will never exit Learning.

Structural problems surface as stable-but-bad performance (not "was fine, now broken"). If the ad set has been underperforming since day 1 despite healthy tracking, suspect structure.

## Layer 3: Creative

Creative problems are the most common cause of degradation. Check:

### Creative Fatigue Indicators

| Indicator                          | Reading                                           |
|-----------------------------------|---------------------------------------------------|
| Frequency > 2.0 weekly             | Same users seeing the ad repeatedly              |
| CTR declining >20% over 3-day roll | Creative losing resonance                        |
| CPM rising with CTR flat or falling| Quality ranking slipping                          |
| Hook rate <25% on new delivery     | Opening 1.5 seconds isn't catching attention     |

If two or more of these trigger → **refresh creative**. See `optimization-actions.md` for the refresh action.

### Frequency-Weighted Performance

Segment the ad's CTR and CVR by frequency bucket (1x, 2–3x, 4–6x, 7+). The bucket where CTR collapses is the saturation point for that creative. Use this to time refreshes precisely.

### CTR Velocity (early detection)

Tracking daily CTR changes detects fatigue 5–10 days earlier than waiting for frequency to spike. If 3-day rolling CTR drops >20% vs. prior 3-day roll, prepare a refresh immediately. Don't wait for frequency to visibly rise — by then the ad set has already wasted a learning cycle.

### Engagement Depth Score

Weight deep interactions more than surface ones:
- 25% video completion > 3-second view
- Saves and shares > likes
- Link clicks to product page > link clicks to homepage

A high 3s view with low 25% completion means the hook works but the body fails. Keep the hook, rewrite the middle.

## Layer 4: Audience

Only diagnose audience after ruling out tracking, structure, and creative. Audience problems in 2026 are less common than advertisers assume because Advantage+ absorbs most of the targeting work.

- **Prospecting audience size:** 1M–10M is the sweet spot. Outside this range → adjust.
- **Lookalike seed quality:** If using a Lookalike, verify the seed was high-value customers (top 10% by LTV) not generic visitors.
- **Detailed targeting over-restriction:** More than 3–4 hard interest constraints → Meta rarely respects them and delivery suffers. Loosen.
- **Narrow Audience (AND/OR) logic:** Use only for B2B or strict niche cases. Overuse strangles delivery.

## Layer 5: Bid & Budget

The last layer because bid changes reset learning and should only happen after ruling out upstream causes.

- **Bid strategy fits the state?** See `decision-thresholds.md` bidding table. New ad sets on Bid Cap or Minimum ROAS are the classic mistake.
- **Budget too low to exit Learning?** Calculate: Daily budget × 7 ÷ target CPA = weekly conversions. Must be ≥50.
- **Budget scaling too aggressive?** More than +20% in a 72-hour window → learning reset. If the ad set was healthy and is now struggling, check recent budget changes first.

## Interpreting Conflicting Signals

Sometimes metrics contradict. Surface the conflict rather than averaging it.

| Pattern                                               | Interpretation                                          |
|-------------------------------------------------------|---------------------------------------------------------|
| High CTR + High frequency + Rising CPA                | Creative loved by existing audience, not scaling to new → need new creative angle, not new audience |
| Low CTR + Low frequency + Stable CPA                  | Niche creative hitting the right niche → don't scale, don't kill |
| High CTR + Low conversion rate                        | Landing page mismatch, not ad problem → escalate to landing page review |
| Healthy CPA + Falling ROAS                            | AOV degradation, not ad problem → check product mix / discounts |
| Conversions reported low, CPA high (B2B)              | Attribution artifact → verify via CRM matching before acting |

When signals conflict and the right action isn't clear, **confidence is "low"** — pause-and-diagnose is safer than scale-or-kill.

## Analysis Output Format

```json
{
  "decision": "refresh_creative",
  "target": {
    "level": "ad_set",
    "id": "23852...",
    "name": "CBO_AUTO_PURCHASE_PURCHASE_ADV+"
  },
  "confidence": "high",
  "rationale": {
    "primary_signal": "ctr_velocity_decline_28pct_3day",
    "supporting_signals": [
      "frequency_2.3_weekly_above_threshold",
      "quality_ranking_slipped_to_average_from_above_average",
      "hook_rate_declined_31pct_to_22pct"
    ],
    "thresholds_referenced": [
      "ctr_velocity_refresh_trigger_20pct",
      "frequency_prospecting_2.0",
      "hook_rate_25pct"
    ],
    "diagnostic_layers_checked": {
      "signal_integrity": "pass",
      "structure": "pass",
      "creative": "fail - fatigue pattern confirmed",
      "audience": "not_evaluated",
      "bid_budget": "not_evaluated"
    }
  },
  "action_parameters": {
    "creatives_to_pause": ["ad_id_1", "ad_id_2"],
    "creatives_to_introduce": "3-5 fresh variants",
    "variant_direction": "same offer, new hook — first 1.5s must change"
  },
  "risks": ["refresh during learning-complete state may temporarily increase CPA as new variants collect signal"],
  "next_review": "72h_post_refresh"
}
```

Then a 2–4 sentence prose summary:

> This ad set's CTR velocity dropped 28% over the last 3 days while frequency climbed to 2.3 weekly and hook rate fell to 22%. Classic creative fatigue pattern — the opening 1.5 seconds is no longer stopping the scroll. Pausing the two lowest-performing variants and introducing 3–5 new hooks against the same offer. Expecting temporary CPA bump as new creatives enter learning.
