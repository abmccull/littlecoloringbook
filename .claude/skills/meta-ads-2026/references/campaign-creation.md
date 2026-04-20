# Campaign Creation

When the calling system asks Claude to launch a new campaign, ad set, or ad, follow this playbook. Every new object follows the **create → QA → activate** sequence. Never create-and-activate in one step.

## Step 1: Select the Campaign Objective

Meta consolidated campaign objectives into six categories:

| Objective      | Use When                                                               |
|----------------|------------------------------------------------------------------------|
| Awareness      | Brand lift, new market entry; no direct-response expectation           |
| Traffic        | Driving clicks to a destination; early-funnel only                     |
| Engagement     | Building social proof, comments, shares; precursor to Sales campaigns  |
| Leads          | Form submissions, newsletter signups, B2B lead capture                 |
| App Promotion  | Mobile app installs or in-app events                                   |
| Sales          | E-commerce purchases, completed conversions with monetary value        |

**Default rule:** If the business goal is a purchase, select **Sales**. If it's a lead form or CRM contact, select **Leads**. Never select Traffic for conversion-intent campaigns — it optimizes for clicks, not converters, and the algorithm learns the wrong pattern.

**PlankMarket/Little Color Book context:** both businesses sell products. Default to **Sales** unless the calling system explicitly requests otherwise (e.g., launching a content awareness play).

## Step 2: Ad Set Configuration

### Audience

Default to **Advantage+ Audience** if:
- Account has ≥50 conversions in the past 30 days, AND
- Budget is ≥$50/day

Otherwise, use a broad audience with Advantage+ turned on as a suggestion layer. Never stack more than 3–4 interest categories as hard constraints.

**Exclusions:**
- For products bought once (e.g., mattresses, certain flooring SKUs): exclude past purchasers
- For subscription or repeat products: do not exclude purchasers
- Always exclude current customers from acquisition campaigns (via CRM Custom Audience)

### Placements

Default to **Automatic Placements**. Manual placements fragment delivery and reduce the algorithm's efficiency. Use manual placements only when:
- Creative is format-specific (e.g., Reels-only creative)
- Specific placements have documented policy conflicts with the creative

### Budget

- **Campaign Budget Optimization (CBO)** is the default. Let Meta distribute across ad sets.
- **Ad Set budgets** only when the advertiser needs to guarantee spend on a specific audience (e.g., retargeting must get $X/day regardless of prospecting performance).
- Start new campaigns at a budget that lets each ad set accumulate ~50 conversions within 7 days. Below this, learning never completes.

### Bid Strategy

New ad set → **Highest Volume** (default). See `decision-thresholds.md` for the staged bidding ladder. Never start a new ad set on Cost Cap, Bid Cap, or Minimum ROAS.

## Step 3: Ad Creative

At least **10 creative variations per asset type** when using Advantage+ Creative, to give the AI enough building blocks for effective testing.

See `creative-generation.md` for format selection and copy frameworks.

### Naming Schema (mandatory)

Every object is named according to a machine-sortable schema. Without this, the system cannot reason about its own campaign history.

```
Campaign:  OBJ_GEO_LANG_OFFER_AUDIENCE_TESTTYPE_YYYY-MM-DD
Ad Set:    BUDGETTYPE_PLACEMENTS_OPT_EVENT_AUDIENCEWINDOW
Ad:        CONCEPT_HOOK_EXECUTION_FORMAT_ASPECT_VARIANT
```

**Example — Little Color Book Sales campaign:**
```
Campaign:  SALES_US_EN_HolidayBundle_MomsUGC_AB_2026-11-01
Ad Set:    CBO_AUTO_PURCHASE_PURCHASE_ADV+
Ad:        FamilyStory_KidOpens_UGC_VIDEO_9x16_V03
```

**Example — PlankMarket Leads campaign:**
```
Campaign:  LEADS_US_EN_BulkPricing_Contractors_NEW_2026-03-15
Ad Set:    ABO_FEED_LEAD_LEAD_ADV+
Ad:        CostSavings_30PctLess_Static_IMAGE_1x1_V01
```

The schema is the contract. Systems that skip it lose the ability to filter and aggregate performance data by dimension.

## Step 4: Launch-Paused QA

All new objects are created in the **paused state**. Before activating, run QA:

- [ ] Pixel fires on the landing page (check via Events Manager test events)
- [ ] CAPI receives matching events with correct `event_id`
- [ ] All UTM parameters present on the destination URL
- [ ] Creative assets match naming schema
- [ ] Audience overlap check: no material overlap (>20%) with other active ad sets
- [ ] Budget matches the Simple System allocation (60/30/10)
- [ ] Domain verified and AEM priorities set
- [ ] For EU-targeted campaigns: DST location fee accounted for in ROAS target (see `eu-compliance.md`)

If any check fails, do not activate. Return the failed checks to the calling system as `decision: "escalate"` or fix automatically if the fix is in scope.

## Step 5: Activation and Initial Monitoring

- Activate the ad set via the Marketing API (`effective_status: ACTIVE`)
- Log the activation timestamp and initial budget to the system's campaign ledger
- Do not touch the ad set for at least 72 hours unless a clear policy/delivery failure occurs
- First performance review at 72h (check delivery, CPM, hook rate)
- Second review at 7 days (check learning phase completion, CPA trajectory)
- Full optimization lifecycle starts after 7 days + 50 conversions

## Decision Output for Campaign Creation

```json
{
  "decision": "launch_campaign",
  "target": {
    "level": "campaign",
    "id": null,
    "name": "SALES_US_EN_HolidayBundle_MomsUGC_AB_2026-11-01"
  },
  "confidence": "high",
  "rationale": {
    "primary_signal": "calling_system_request",
    "supporting_signals": ["account_has_sufficient_conversion_history", "budget_meets_learning_threshold"],
    "thresholds_referenced": ["learning_phase_50_conversions", "advantage_plus_eligibility_$50/day"]
  },
  "action_parameters": {
    "objective": "OUTCOME_SALES",
    "budget_optimization": "CBO",
    "daily_budget": 100,
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "placements": "automatic",
    "audience": "advantage_plus_audience",
    "ad_count": 10,
    "creative_format_mix": ["UGC_video", "static_image", "carousel"],
    "initial_status": "PAUSED",
    "qa_checks_pending": ["pixel_verification", "capi_event_match", "audience_overlap"]
  },
  "risks": ["account has no EU-specific exclusion — verify before activation if EU delivery undesired"],
  "next_review": "72h_post_activation"
}
```
