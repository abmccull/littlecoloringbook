# Creative Generation

When the calling system asks Claude to generate ad creative — copy, hooks, variant specifications — use these frameworks. Creative is the targeting mechanism in 2026; the creative decides who the algorithm serves the ad to.

## Format Selection

Pick the format first. Format shapes everything downstream.

| Format                  | Best For                                            | Aspect Ratio      |
|-------------------------|-----------------------------------------------------|-------------------|
| Short-Form Video (UGC)  | Prospecting, emotional/lifestyle products           | 9:16 (Reels/Stories) |
| Static Image            | Clear-value products, fast scrollers, text overlays | 1:1 (feed), 9:16 (stories) |
| Carousel                | E-commerce multi-product, step-by-step storytelling | 1:1                |
| Reels / Stories         | Anything mobile-first — nearly all engagement       | 9:16 vertical      |

### Format decision rules

- **Default to 9:16 vertical.** Nearly all engagement comes from mobile. 1:1 is secondary. 16:9 is for specific placements only.
- **UGC-style video outperforms studio production** in most consumer verticals. In beauty specifically, UGC converts 3–4× better than studio photography.
- **Static images are underrated.** In fast-scrolling feeds, a clear image with a compelling headline communicates value instantly. Video requires several seconds of investment before payoff.
- **Carousels are the e-commerce workhorse.** Use for PlankMarket-style multi-SKU showcasing or Little Color Book-style process demonstration.

**Default mix for a new campaign (Advantage+ Creative):**
- 4–5 UGC-style video variants (9:16)
- 3–4 static image variants (1:1 and 9:16)
- 2–3 carousel variants (if product catalog supports it)

Total: ≥10 creative variations across asset types, per Meta's recommendation for Advantage+ Creative.

## Copy Frameworks

Three proven frameworks. Pick based on the product's dominant sales driver.

### 1. Problem → Solution
Use when the product solves an obvious frustration.

**Template:**
> [Problem phrased as a pain the user recognizes]? [Product] [specific mechanism] in [timeframe]. [CTA].

**Example (Little Color Book):**
> Tired of screens capturing your kids' attention? Our personalized coloring books turn your family photos into pages they actually want to finish. Order yours.

**Example (PlankMarket):**
> Project quoted at $12/sqft killing your margin? Browse end-of-run flooring at 40–60% off — same brands, pallet quantities. Shop now.

### 2. Social Proof First
Use when the product has volume or testimonials.

**Template:**
> [Number] [specific user type] are [doing the thing]. [Product]. Here's why...

**Example:**
> 34,000 women are using our collagen gummies to support skin elasticity. Here's why...

### 3. Specificity Hook
Use when differentiation is the key. Opens by calling out a specific frustration to pre-qualify the audience.

**Template:**
> If you're tired of [specific failed alternative] that [specific failure mode], you need to know about this.

**Example (Little Color Book):**
> If you're tired of generic activity books that sit in a drawer after one use, you need to know about this.

### Copy Length
Meta recommends ≤125 characters for primary text. Short attention spans in 2026 make longer copy a liability in most cases. Exception: long-form copy can work for high-consideration purchases (B2B, expensive products) where the reader self-selects into the text.

## Hook Engineering

The first 1.5 seconds of video determine whether a user watches. Hook rate (3s view %) target is **≥25%**.

### Hook categories that work in 2026

| Hook Type          | Example                                                    |
|-------------------|-------------------------------------------------------------|
| Pattern interrupt  | Unexpected visual in frame 1 (unboxing a coloring book like a gift) |
| Question hook      | "Can a coloring book replace an iPad?"                     |
| Result-first       | Show the finished product/outcome before the reveal        |
| Problem statement  | Open with a visible pain point                             |
| POV / handheld     | Selfie-framed opening, first-person perspective            |
| Specificity        | "Day 28 of using this..." or "My kid's first reaction..."  |

### When refreshing a fatigued creative

The calling system may request new variants for an ad set where hook rate has fallen below 25%. The rule: **keep the offer and body, change the hook.** Don't reinvent the ad — reinvent the opening.

## Advantage+ Creative

Advantage+ Creative mixes and matches images, videos, headlines, and descriptions to find winning combinations per user. To feed it well:

- **≥10 variations per asset type** (images, videos, headlines, primary text)
- **Variations should test different angles**, not just different wording (Problem→Solution vs Social Proof vs Specificity)
- **Include at least 3 distinct hooks** so Andromeda can map different users to different openings

Single-variant ads starve Advantage+ Creative of the material it needs.

## Creative Intelligence Library (CIL)

When generating creative, the calling system should log outcomes back into a Creative Intelligence Library — a record of what resonated, why, and for how long. The CIL fuels the next cycle of production.

**What the CIL should store per winning creative:**
- Ad ID and name (per naming schema)
- Format, hook type, copy framework used
- Performance metrics at peak and at retirement (hook rate, CTR, CPA, frequency at kill)
- Days-to-fatigue (how long the ad lasted before needing refresh)
- Audience and placement breakdown where it performed best

Over time the CIL becomes the most valuable asset in the account — more valuable than audiences, bids, or structure. It informs which hooks, which frameworks, and which formats to emphasize in each new creative cycle.

## Creative Generation Output Format

When the calling system requests new creatives, return:

```json
{
  "decision": "generate_creatives",
  "target": {
    "level": "ad_set",
    "id": "...",
    "name": "..."
  },
  "confidence": "high",
  "rationale": {
    "primary_signal": "creative_refresh_requested | new_campaign_launch",
    "supporting_signals": ["prior_winning_hook_type:result_first", "offer:unchanged"],
    "thresholds_referenced": ["advantage_plus_creative_10_variants"]
  },
  "action_parameters": {
    "variants": [
      {
        "variant_id": "V01",
        "format": "UGC_video_9x16",
        "hook_type": "pattern_interrupt",
        "hook_copy": "Wait until you see page 4...",
        "primary_text": "Turned our family photos into a coloring book the kids actually finish. Link in bio.",
        "cta": "SHOP_NOW",
        "naming": "FamilyStory_Page4Reveal_UGC_VIDEO_9x16_V01"
      },
      {
        "variant_id": "V02",
        "format": "static_1x1",
        "hook_type": "result_first",
        "hook_copy": "n/a (static)",
        "primary_text": "34,000 families have turned their photos into keepsake coloring books. Here's yours.",
        "cta": "SHOP_NOW",
        "naming": "SocialProof_34KFamilies_Static_IMAGE_1x1_V02"
      }
    ]
  },
  "risks": ["new creatives enter learning; expect 72h CPA variance"],
  "next_review": "7_days_post_launch"
}
```

Then a short prose summary naming the strategic direction:

> Generated 10 variants following Problem→Solution, Social Proof First, and Specificity frameworks across UGC video and static formats. Hook types vary (pattern interrupt, result-first, question) to give Andromeda mapping room. All variants maintain the current offer and body copy — only the opening 1.5 seconds changes.
