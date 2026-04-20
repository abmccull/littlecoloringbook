# EU Compliance

When campaigns target EU users, regulatory factors materially change the economics and delivery. In 2026, Meta's EU operations are governed by the GDPR, DMA, and DSA. Two practical implications dominate.

## The "Third Option" and Contextual Ads

In January 2026, Meta introduced a choice for EU users:
1. Fully personalized ads (with full tracking)
2. Ad-free paid subscription
3. "Less personalized" free version — contextual signals only

The third option relies on **contextual signals** (the specific group or post being viewed) rather than behavioral profiles. For a portion of the EU audience, ads are now targeted by content context, not user behavior.

### What this means operationally

- **A portion of the EU audience is unreachable by behavioral targeting.** Even with perfect tracking, Advantage+ Audience, and Lookalikes, some EU users are served contextual-only. Your addressable EU audience is smaller than the demographic size suggests.
- **Creative that only works via behavioral targeting will underperform on EU.** Creative that signals its relevance through context (clearly stating the problem, the audience, the use case in the frame/copy) performs better on contextual delivery.
- **EU CPMs can look misleadingly cheap on contextual delivery** — the impressions are real but the intent quality may be lower. Don't scale EU campaigns based on CPM alone; watch CPA.

### When to flag EU-sensitive campaigns

Any campaign with >20% of delivery in EU member states should be logged as EU-sensitive in the system's ledger. This triggers:
- DST fee accounting (below)
- Wider tolerance for CPA variance (contextual delivery is noisier)
- Different creative evaluation criteria (prefer creative with strong in-frame context signaling)

## Digital Services Tax (DST) Location Fees

Starting **July 2026**, Meta passes the cost of Europe's turnover-based Digital Services Taxes directly to advertisers via **location fees** added to ad buys targeting users in specific countries, **regardless of where the advertiser is based**.

### The fee schedule

| Country              | DST Location Fee |
|----------------------|------------------|
| Austria              | +5%              |
| Turkey               | +5%              |
| France               | +3%              |
| Italy                | +3%              |
| Spain                | +3%              |
| United Kingdom       | +2%              |

These are added to the effective cost — a campaign targeting France at $100/day effectively costs $103/day.

### Operational consequences

- **ROAS calculations must include DST.** Platform-reported ROAS doesn't account for the fee. If the system is comparing performance across countries or setting Minimum ROAS targets, adjust for DST.
- **Audience-level targeting split by country** is worth considering for mixed-country EU campaigns — so the system can see which countries are profitable *after* DST and allocate accordingly.
- **Budget pacing** on DST-affected countries will deliver slightly less impression volume than equivalent spend in non-DST countries.

### Minimum ROAS target adjustment

When setting a Minimum ROAS target for an ad set delivering to DST countries:

```
Adjusted ROAS target = Base ROAS target × (1 + DST rate)
```

Example: If the base ROAS target is 3.0 for a Spain-targeted ad set, adjust to 3.0 × 1.03 = 3.09 to preserve true profitability.

## Decision Rules for EU Campaigns

When the calling system requests a new campaign with EU targeting:

1. **Account for DST in the ROAS target at campaign creation time.** Don't rely on after-the-fact reconciliation.
2. **Flag the campaign in the ledger as EU-sensitive.**
3. **Set wider CPA tolerance windows** (say, ±30% vs ±20% for US campaigns) to absorb contextual delivery noise.
4. **Prefer creative with in-frame context signaling** (the ad visually/textually states who it's for and what it is).
5. **If the account primarily sells outside the EU and EU delivery is accidental**, add country exclusions rather than pay DST on unintended delivery.

## Escalation Triggers for EU Campaigns

Escalate (`decision: "escalate"`) when:

- A campaign targeting France, Italy, Spain, UK, Austria, or Turkey is launched **without** DST fees being accounted for in the ROAS target.
- EU delivery exceeds 30% for a campaign the calling system labeled as US-primary.
- Contextual delivery (inferred from a mismatch between behavioral-signal-based performance predictions and actual delivery) appears to be >40% of EU impressions — this is outside the usual range and worth human review.

## Decision Output Addition for EU Campaigns

When the decision affects an EU-targeting campaign, add an `eu_context` block to the action parameters:

```json
{
  "action_parameters": {
    "...standard fields...",
    "eu_context": {
      "dst_countries_targeted": ["FR", "ES"],
      "dst_fee_applied": "3%",
      "adjusted_roas_target": 3.09,
      "contextual_delivery_tolerance": "wider_cpa_window_30pct",
      "flagged_as_eu_sensitive": true
    }
  }
}
```

This ensures the finance side of the calling system can reconcile DST at month-end without guessing.
