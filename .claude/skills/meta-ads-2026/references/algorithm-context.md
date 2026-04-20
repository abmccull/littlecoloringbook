# Algorithm Context

This reference exists for when Claude needs to explain *why* the algorithm is behaving a certain way — not to drive routine decisions. Use the decision references for action; use this for reasoning about novel patterns.

## The Two Engines

### Andromeda — Creative Gatekeeper

Andromeda is the initial intelligence layer. It analyzes ad creative — video frames, image themes, emotional sentiment of headlines — to determine which users might engage. It "reads" the ad like a person would, identifying themes:

- Urgency
- Curiosity
- Social proof
- Aspiration
- Problem/solution framing

Andromeda matches those signals to users who have shown affinity for similar content.

**The operational consequence:** Targeting has shifted from the advertiser to the creative. The ad *is* the targeting mechanism. When a creative gets mismatched to the wrong audience, the usual cause is that the creative doesn't clearly signal "who this is for." Before diagnosing an audience problem, inspect the creative for ambiguous or generic signaling.

### GEM — Delivery Optimizer

The Global Engagement Model (GEM) takes over once the ad has been shown. GEM predicts what content should appear next in the user's feed based on immediate context and behavior. GEM pulls data from organic interactions on Instagram to understand user intent — organic engagement feeds paid delivery.

**The operational consequence:** An Instagram account with strong organic engagement improves GEM's confidence in serving the same user paid content. For businesses with organic presence (Little Color Book's Instagram, for example), the organic feed is an input to paid performance, not a separate channel.

## The Auction: Total Value

Meta's ad auction picks the winning ad for each impression using:

**Total Value = Bid × Estimated Action Rate (EAR) × Ad Quality Score**

### Estimated Action Rate (EAR)
The algorithm's prediction that a user will convert on this specific ad. Driven by user history, creative characteristics (as read by Andromeda), and context.

### Ad Quality Score
Derived from user feedback (hides, reports, positive engagement), engagement history, and relevance. Meta classifies each ad into:

- **Above Average** — top 35%
- **Average** — middle 30%
- **Below Average** — bottom 35%

### The Strategic Implication

Quality ranking acts as a multiplier on every dollar of spend. A Below Average ad at a high bid still loses to an Above Average ad at a lower bid, because Total Value favors quality.

Practical consequences:

- When performance is poor, the first lever is **creative quality** (which lifts EAR and Ad Quality Score), not budget.
- When scaling, quality ranking multiplies the return on every additional dollar.
- In saturated verticals, the advertiser with better creative gets cheaper impressions at lower bids.

## Why Advantage+ Wins

Advantage+ wins not because Meta's targeting is mystically better, but because:

1. **It lets Andromeda do its job.** Over-restricted detailed targeting prevents Andromeda from routing the creative to its ideal audience.
2. **It feeds GEM richer signal.** Broader delivery means more interaction data, more learning, faster optimization.
3. **It takes the human out of an unwinnable loop.** Humans cannot hand-optimize across the number of variables Meta's system sees in real time.

This is why, for accounts with conversion history and adequate budget, Advantage+ Audience typically cuts CPA by up to 32% and delivers CPMs nearly $1 lower than manual detailed targeting.

## When to Override the Algorithm

The defaults are Advantage+ and broad targeting. Override only when:

- **Legal requirement** — age-restricted products, regulated categories (alcohol, finance, etc.)
- **Tiny niche ICP** — B2B with fewer than 500K people globally who could conceivably convert
- **Brand safety carveouts** — categorical exclusions the algorithm won't infer on its own (e.g., competitor employees)
- **No conversion history** — new accounts where Advantage+ has nothing to learn from; start manual-broad, then migrate

Override is the exception, not the rule. Autonomous systems should default to letting the algorithm work.

## The 2025–2026 Performance Lift

The Andromeda + GEM stack drove measurable improvements in the 2025 updates:
- 3.5% increase in ad clicks
- 1% rise in Instagram conversions

These aren't huge numbers in isolation — but they compound across the auction's scale, meaning most advertisers saw meaningful efficiency gains from doing nothing except letting Advantage+ run.
