# Decision Thresholds

Every benchmark below maps to a specific action. When a metric crosses a threshold, the indicated decision is the default unless other signals contradict it. These thresholds are the numerical spine of the skill.

## Tracking & Signal Health

| Metric                     | Target Range   | Action if Outside Range                                                      |
|----------------------------|----------------|------------------------------------------------------------------------------|
| EMQ (Purchase)             | 8.0 – 9.3      | If <8.0: audit CAPI identifiers. If <6.0: escalate; downstream is unreliable.|
| EMQ (Lead)                 | 7.5 – 9.0      | If <7.5: add email + phone + external_id to CAPI payload.                    |
| Event deduplication        | 100% matched   | Any duplicates in Events Manager → fix `event_id` generation immediately.    |
| CAPI Events Received       | Matches Pixel  | If CAPI receiving <80% of Pixel events → server-side integration is broken.  |

**Decision rule:** any tracking metric outside range → `decision: "escalate"` unless the task is explicitly "fix tracking." No other optimization decisions are reliable until tracking is healthy.

## Creative Performance

| Metric                         | Healthy Range        | Action if Failing                                 |
|--------------------------------|----------------------|---------------------------------------------------|
| Hook Rate (3s video view %)    | ≥25%                 | Change first 1.5 seconds of video                 |
| CTR (Sales objective)          | 1.3% – 1.4%          | Refresh creative or expand audience               |
| CTR (Traffic objective)        | ≥1.0%                | Refresh creative                                  |
| Frequency (Prospecting)        | <2.0 weekly          | Add 3–5 fresh creative variations                 |
| Frequency (Retargeting)        | <4.0 weekly          | Rotate creative or narrow window                  |
| Video completion rate (25%)    | Track as engagement  | Weight higher than 3s views in Engagement Depth   |
| CPM                            | Industry benchmark   | If >20% above baseline → check quality ranking    |

### CTR Velocity / Decay (Creative Fatigue)

Tracking daily CTR changes detects fatigue 5–10 days earlier than waiting for frequency to spike.

| CTR Trend (rolling 3-day vs. prior 3-day) | Decision                            |
|-------------------------------------------|-------------------------------------|
| CTR down 10–20%                           | Monitor; check frequency trajectory |
| CTR down 20–30%                           | Prepare creative refresh            |
| CTR down >30%                             | Refresh creative now                |

### Quality Rankings

Meta surfaces three rankings per ad: Quality, Engagement Rate, Conversion Rate. Each is Above Average (top 35%), Average (middle 30%), Below Average (bottom 35%).

| Ranking Combination                                  | Decision                                |
|------------------------------------------------------|-----------------------------------------|
| Any Above Average                                    | Keep running; scale if CPA healthy      |
| All three Average                                    | Keep running; monitor fatigue           |
| One Below Average                                    | Refresh the weakest dimension           |
| Two or more Below Average                            | Pause; create fresh variants            |
| All three Below Average                              | Pause immediately                       |

## Learning Phase

| Weekly Conversions per Ad Set | State                 | Allowed Actions                                      |
|-------------------------------|-----------------------|------------------------------------------------------|
| <50                           | Learning              | Avoid budget changes >20%, no bid strategy changes   |
| 50+                           | Learning Complete     | Full optimization lifecycle available                |
| Exited Learning Limited       | Stuck                 | Duplicate ad set with broader audience or more signal|

## Budget Scaling

| CPA vs. Target | ROAS vs. Target | Decision                           | Max Change per 72h |
|----------------|-----------------|-------------------------------------|---------------------|
| Below target   | Above target    | Scale                              | +20% budget         |
| At target      | At target       | Hold                               | No change           |
| Above target   | Below target    | Reduce budget or pause             | −25% or pause       |
| Unstable       | Any             | Hold; diagnose before changing     | No change           |

**Scaling rule:** Never more than +20% budget per 72-hour window on an ad set with healthy performance. Larger jumps reset learning even for exited ad sets because CPM tiers shift. For vertical scale beyond 20%, duplicate the ad set instead of raising budget.

## Bidding Strategy Selection

Stage-gate by learning state and margin requirements.

| State                                          | Bid Strategy        | Notes                                              |
|------------------------------------------------|---------------------|----------------------------------------------------|
| New ad set, <50 conversions/week               | Highest Volume      | Collect signal; accept variable CPA                |
| Stable ad set, need CPA control                | Cost Cap            | Set cap at 10–15% above current average CPA        |
| Flash sale or strict margin window             | Bid Cap             | Only for short periods; risks zero delivery        |
| Profit-optimized e-commerce                    | Minimum ROAS        | Requires high volume; not for <$1K/day spend       |

**Never** start a new ad set on Bid Cap or Minimum ROAS. Algorithm needs signal first. This is a common autonomous-agent failure mode.

## Audience Sizing

| Audience Type       | Target Size        | Action if Outside Range                      |
|---------------------|--------------------|----------------------------------------------|
| Prospecting         | 1M – 10M people    | <1M: broaden. >10M: segment or let Adv+ handle |
| Lookalike seed      | ≥1,000 people      | <1,000: expand seed or use broader trigger   |
| Custom Audience (RT)| ≥500 matched       | <500: accumulate more data before using      |

## Attribution Windows (2026 State)

- Click-through: 1-day, 7-day, 28-day (reporting only)
- View-through: **1-day only** — longer view windows have been removed
- Engage-through: new attribution type (March 2026) for non-link interactions
- Video view threshold for "engaged view" conversion: **5 seconds** (lowered from 10s in March 2026)

**Decision implication:** B2B and long-sales-cycle businesses will see platform-reported conversions look artificially low. Use CRM matching via CAPI `external_id` to reconstruct causal impact. Don't make budget decisions based on platform-reported ROAS alone in these cases.

## EU Digital Services Tax Fees (in effect July 2026)

Add these to effective CPM when calculating ROAS for EU-targeted campaigns:

| Country               | DST Location Fee |
|-----------------------|------------------|
| Austria, Turkey       | +5%              |
| France, Italy, Spain  | +3%              |
| United Kingdom        | +2%              |

These fees apply to ad buys targeting users in these countries **regardless of where the advertiser is based**. ROAS calculations that don't account for DST will overstate profitability on EU campaigns.

## Metric Summary Card

Use this as a quick-reference when scanning an ad set's performance:

```
Healthy ad set (prospecting, Sales objective):
  Hook Rate    : ≥25%
  CTR          : 1.3% – 1.4%
  Frequency    : <2.0 weekly
  EMQ Purchase : 8.0 – 9.3
  Quality Rank : Above Average or Average on ≥2 of 3 dimensions
  Conversions  : ≥50/week (learning complete)
  CPA          : at or below target
  ROAS         : at or above target

If any two of these are failing → diagnose before acting. If four+ → pause.
```
