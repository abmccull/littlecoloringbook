# Little Color Book — Project Context

**This file overrides or supplements the generic playbook when operating on Little Color Book specifically.** Read it for any LCB decision alongside the matching topic reference. Numbers here come from real unit economics, shipped code, and tested funnel behavior. When a generic reference conflicts with this file, this file wins.

---

## 1. Product & Funnel

### What we sell

AI-generated personalized coloring books made from customer photos, sold at **littlecolorbook.com**.

- **Input:** customer uploads photos of their kids, pets, or family
- **Output:** black-and-white line-art coloring pages, delivered as PDF and optionally printed as spiral-bound book via Lulu POD
- **Acquisition hook:** free 1-page sample (email required)

### The funnel (paid Meta version)

```
Cold Meta ad
  ↓ click
/sample landing page  ← ALL paid Meta traffic lands here
  ↓ email + photo upload
Sample generation (Gemini 2.5 Flash → 3.1 Flash → 3 Pro ladder, 95% QC pass)
  ↓ email delivery with sample + upsell CTA
/create page (warm only — NEVER send cold paid traffic here)
  ↓ build book (pick pages, pick PDF vs print, upload more photos)
Stripe checkout
  ↓
Paid order → pipeline renders → PDF and/or Lulu print job
```

**Never run cold Meta traffic directly to `/create`.** Cold direct-to-paid conversion on this product is ~1% because customers need to trust output quality before paying. `/create` is for warm traffic (email clicks, retargeting, referral links, organic, return visitors).

### Campaign objective mapping — optimize for the money event, not the midway event

The sample is a **step in the funnel**, not the goal. Customers who submit email and never buy are not the audience we want to find more of. Meta's algorithm learns whatever event we optimize for — so we optimize for **Purchase**, even when the ad lands on `/sample`. The landing page is `/sample` because it's the highest-converting first step for cold traffic; the conversion event Meta optimizes toward is Purchase because that's where revenue happens.

**Default: Sales campaigns with Purchase optimization, everywhere.**

| LCB traffic | Campaign objective | Conversion event Meta optimizes on | Landing page |
|---|---|---|---|
| Cold prospecting | **Sales** | **Purchase** (with `order_value`) | `/sample` |
| Retargeting sample submitters | **Sales** | **Purchase** | `/create` (pre-loaded with their sample) |
| Retargeting `/create` abandoners | **Sales** | **Purchase** | `/create` |
| Creator whitelisted content | **Sales** | **Purchase** | `/sample` or `/create` depending on the creator's CTA |
| Brand awareness / list velocity push | Engagement or Reach | n/a | `/sample` |

**Leads objective is a bootstrap, not a default.** Only use Leads (optimized on sample submission) when:
- Purchase event volume is below 50/week in the ad account (can't clear learning phase on Purchase)
- A brand-new product launch with zero conversion history
- Deliberately running a list-growth blitz (rare, time-boxed)

Once Purchase volume crosses ~50/week, every prospecting campaign should switch to Sales/Purchase optimization. Re-run Leads-optimized campaigns on Purchase to confirm. Audit quarterly — any campaign still on Leads after 50+/week Purchase volume is a leak.

### Value Optimization — upgrade when volume allows

Once Purchase events exceed ~100/week with clean attribution, switch from Purchase optimization (count-based) to **Value Optimization (VBO)** where Meta bids on expected revenue per user, not expected conversion count. This automatically prioritizes high-AOV buyers (print tiers, multi-copy bundles) over low-AOV buyers (pdf-30 only).

- Enable when: ≥100 Purchase events/week with `order_value` present on all events, EMQ ≥ 8.0 on Purchase
- Effect: ROAS improves typically 15–30% because algorithm finds print-and-upsell buyers preferentially
- Risk: requires very clean value signal — if Stripe refunds don't flow back into the Purchase event stream, VBO over-values ghost revenue

### Conversion event structure (required for Sales/Purchase optimization)

- **Purchase event** (primary optimization target): pixel + CAPI event `Purchase` with:
  - `order_value` in USD (Stripe charge total minus shipping)
  - `currency`: "USD"
  - `content_ids`: offer code(s) in the order
  - `content_type`: "product"
  - Fires on Stripe webhook confirmation — never on client-side redirect (too lossy)
- **Sample event** (secondary lead signal — always fires, even on Sales campaigns): pixel + CAPI event `Lead` or custom `sample_submitted`
  - Fires when email + photo are confirmed on `/sample`
  - Meta sees this as a mid-funnel signal; helps the algorithm understand the buyer journey even though it doesn't optimize on it
- **Initiate Checkout** event: fires when the user hits `/create/checkout`
- **Add to Cart**: fires when they pick an offer tier on `/create`

All four events help the algorithm map the full journey. Optimization still targets Purchase.

All events must be de-duplicated via `event_id`. EMQ targets: **Purchase ≥ 8.0 (critical)**, sample_submitted ≥ 7.5, others ≥ 7.0. If Purchase EMQ < 7.0: escalate per `tracking-capi-audit.md` — every other decision is operating on broken signal.

### Dual-metric reporting (both signals matter, even though only one is optimized)

Report every campaign on BOTH dimensions, always:

- **Acquisition metric**: CPL (cost per email/sample captured) — measures top-of-funnel efficiency, list growth rate
- **Revenue metric**: CAC (cost per paid customer) and ROAS — measures whether we're finding buyers, not just browsers

If CPL is great but CAC is terrible, the campaign is attracting tire-kickers — refresh creative or narrow audience even though CPL looks fine. If CAC is great but CPL is bad, we're being efficient with existing demand but not building list fast — consider a separate list-growth campaign.

The dashboard at `/admin/metrics` should show both side-by-side per campaign.

---

## 2. Pricing ladder (canonical — always verify against `packages/shared/src/offers.ts`)

| SKU | Price | Gross profit | Margin | Role |
|---|---|---|---|---|
| pdf-30 | **$24.99** | $22.11 | 88.5% | Paid acquisition anchor — primary ad landing |
| pdf-50 | $39.00 | $34.47 | 88.4% | Pages upgrade |
| pdf-100 | $59.00 | $50.79 | 86.1% | Premium pages anchor |
| print-30 | $49.00 | $36.88 | 75.3% | Print starter |
| print-50 | $54.00 | $39.75 | 73.6% | Print sweet spot |
| print-100 | $99.00 | $78.50 | 79.3% | Hero anchor SKU |

**Gross profit** is revenue − Stripe fees (2.9% + $0.30) − Gemini cost (100 pages × ~$0.062) − Lulu POD cost (print only, real API-quoted). No 40% placeholder — real per-order Lulu cost is captured in `fulfillment_jobs.cost_cents` or `shipping_quotes.quote_payload`.

### Pricing psychology to maintain

- pdf-30 at $24.99 is **intentionally under $25** so it lands in the Facebook $10–25 CAC band (~$10.54 benchmark)
- print-50 at $54 is **intentionally under $55** so it stays in the $25–50 band for any direct/retargeting campaigns on that SKU
- print-100 at $99 is **the anchor** — never raise to $100+; the "under three digits" signal matters

---

## 3. Unit economics for ad decisions

### CAC benchmarks (know which one applies)

| CAC metric | Value | When to use |
|---|---|---|
| **Facebook industry benchmark (pdf-30 band)** | $10.54 | Starting assumption for new cold campaigns on pdf-30 |
| **Target acquisition CAC (direct paid)** | $10 | Planning target; break-even math below |
| **30-day effective CAC (sample funnel)** | $27.75 | Immediate P&L on first paid cohort |
| **90-day effective CAC (with email nurture)** | $16.65 | **This is the blended planning number** — matches LTV cadence |
| **12-month effective CAC (with reactivation)** | $11.10 | Steady-state once list compounds |
| **Absolute ceiling (don't exceed)** | $33.08 | First-order break-even; above this = losing money before any LTV |

### Weighted gross profit per acquired customer (base upsell mix)

Customer enters at pdf-30; post-conversion upsell cascade distributes across tiers:

| Tier | Mix | Gross contribution |
|---|---|---|
| pdf-30 | 45% | $9.95 |
| pdf-50 | 15% | $5.17 |
| pdf-100 | 5% | $2.54 |
| print-30 | 15% | $5.53 |
| print-50 | 15% | $5.96 |
| print-100 | 5% | $3.93 |
| **Weighted gross / customer** | | **$33.08** |
| AOV | | ~$41.95 |

If metrics show a shift — e.g. print mix climbs above 40% or below 25% — update the weighted gross and recompute CAC ceiling. Don't optimize based on stale mix.

### Sample funnel conversion targets

| Stage | Conservative | **Target** | Optimistic |
|---|---|---|---|
| Click → sample start (email + photo) | 25% | **30%** | 40% |
| Sample → paid (30-day) | 8% | **12%** | 15% |
| Sample → paid (90-day, with email nurture) | 14% | **20%** | 28% |
| CPL (cost per email captured) | $6 | **$3.33** | $1.88 |

CPL is the single most important operational metric. Derive from `ad_spend / emails_captured`. If CPL trends above $4.50: degraded performance → diagnose creative or saturation before scaling further.

### Breakeven math (reference when deciding to scale/pause)

- **Break-even CPL on paid alone (no email reactivation):** $3.97
  - At 12% sample-to-paid conversion, $33.08 gross per customer
  - Marginal dollar above $3.97 CPL loses money on first cohort
  - Still worth spending IF email nurture + reactivation bring 90-day effective CAC below $16.65
- **Market size:** the addressable audience (US parents and grandparents buying for kids ages 2–10) is in the tens of millions of households. We have no evidence of paid-Meta saturation at any specific spend level yet. **Do not assume a monthly ad budget ceiling — scale until the data says to stop.**
- **How to detect actual saturation (data-driven, not assumed):**
  - 7-day trailing CPL climbs above $4.50 and stays there for 7+ consecutive days despite creative refresh
  - Sample-to-paid conversion degrades below 8% in the same window (signals we're reaching weaker-intent audiences)
  - Frequency on prospecting audiences exceeds 2.5 weekly across fresh creative
  - Click-through rate drops >30% from the trailing 30-day baseline
- **When those signals fire together**, that's the real saturation point — could be $15K/month, could be $300K/month. Measure, don't guess. Until real saturation is visible, the 50% reinvestment rule continues to scale ad spend uncapped.

---

## 4. Reinvestment rule (growth model)

**50% of weekly gross profit is reinvested into next period's ad spend**, on top of existing base budget, until marginal CPL hits diminishing returns.

Mechanic:
```
next_week_ad_spend = this_week_ad_spend + (0.5 × this_week_gross_profit)
```

Stop-loss conditions (when to NOT reinvest, regardless of the 50% rule):
- CPL > $4.50 and trending up over 3 days
- 30-day sample-to-paid conversion drops below 8%
- Pipeline can't fulfill incoming orders within 72 hours (capacity limit)
- EMQ falls below 7.5 on any conversion event (signal broken — fix first)

When stop-loss triggers: hold ad spend flat, divert reinvestment budget to email program, creator program, or retained earnings.

---

## 5. Creative generation — Little Color Book specifics

### Brand voice — authoritative source

The canonical voice profile lives at **`brand/voice-profile.md`** (generated via the `/brand-voice` skill). Read it before writing any ad copy. Don't fabricate voice rules here or anywhere else — that file is the source of truth, and this section is only a pointer.

Quick pointers from that profile (read the full file for specifics):
- Voice: "warm, bright, and specific — the capable mom friend who already found the easiest thoughtful thing to do with the photos on your phone"
- Never corporate, never syrupy-cute
- Feels premium, practical, emotionally real
- Vocabulary guide + use-often/avoid lists are in the profile file
- Alec's personal voice (when copy is published as him, not as the brand) comes from the `/alecs-voice` skill

If something about brand voice isn't answered by `voice-profile.md`, update that file — don't answer it in this context file.

### Format mix for new campaigns (override `creative-generation.md` default mix)

Little Color Book skews heavier toward UGC-style Reels because the product is visually transformational (photo → coloring page):

- **5–6 UGC-style Reels** (9:16, 15–30s) showing photo-to-page transformation
- **2–3 static image variants** (1:1 + 9:16) showing finished coloring pages next to source photo
- **2 carousels** (1:1) — multi-page walkthroughs of different customer books
- Minimum 10 total variants

### Creative hooks that work for this product

Ranked by observed conversion signal:

1. **Before/after reveal** — source photo → finished coloring page, side-by-side
2. **Kid coloring their own page** — UGC of child with the book
3. **Gift reveal** — grandparent opening a personalized book
4. **"This is my daughter [name]"** — narrator-driven, names the real kid
5. **Process demo** — upload → AI generates → print
6. **Testimonial** — parent explaining why it became their kid's favorite

Avoid:
- Stock imagery (conflicts with "personalization" value prop)
- AI-generated-looking thumbnails (kills trust)
- Heavy text overlays (Andromeda reads creative; busy text hurts)

### Creative fatigue rules (from `decision-thresholds.md`, tuned for LCB)

- Frequency > 2.0 weekly on a prospecting ad set → refresh within 72h
- CTR drops >30% over 5 days → creative fatigue, rotate
- Hook rate (3s view) < 20% after 1,000 impressions → kill, replace

### Pet angle

Our product generates coloring pages of pets too. Separate creative set targeting pet-parent audiences performs meaningfully different from family/kid creative. Track separately; don't blend into general ad sets.

---

## 6. Audience strategy for this product

### Advantage+ Audience defaults

- **Use Advantage+ Audience** as the default for cold prospecting. The generic skill's guidance applies.
- **Seed suggestion layer** with: parents of kids under 10, gift shoppers, craft enthusiasts — but treat these as hints, not hard constraints.
- **Never stack more than 3 interest categories** as rigid filters.

### Audiences worth building explicitly

| Audience | Source | Use case |
|---|---|---|
| Purchasers (180-day) | Pixel + CAPI, synced to custom audience | Exclusion for prospecting; seed for lookalikes |
| Sample submitters, no purchase (30/60/90d) | Pixel event | Retargeting pool — hottest audience we have |
| `/create` visitors, no purchase (30d) | Pixel event | High-intent retargeting |
| Email list members (Klaviyo sync) | CRM | Lookalike seed + exclusion |
| 1% lookalike of purchasers | Custom audience | Cold prospecting layer |
| 3% lookalike of email list | Custom audience | Broader cold layer |

### Retargeting windows

- Sample submitters: primary window 0–14 days (highest conversion), secondary 14–60 days, tertiary 60–180 (lowest but cheap)
- `/create` abandoners: 0–7 days urgent, 7–30 days recovery

---

## 7. Attribution stack

| Event | Where it lives | What it's for |
|---|---|---|
| Sample submitted | `sample_orders` table + pixel event + CAPI | Lead conversion tracking |
| Purchase | `orders` table + Stripe webhook + pixel + CAPI | Revenue attribution |
| Lulu cost per order (real) | `fulfillment_jobs.cost_cents` | Real gross margin per order |
| Lulu cost quoted (pre-fulfillment) | `shipping_quotes.quote_payload.productionCostCents` | Real gross margin before fulfillment |
| Creator attribution | Per-creator unique promo code (to be built) | Rev share tracking |
| UTM parameters | `orders.utm_*` columns + `first_touch` JSONB | Source attribution |

**No 40% placeholder anywhere.** All Lulu costs are real API-quoted. See `packages/shared/src/lulu-cost.ts` for the fallback formula when neither is available.

### EMQ optimization priorities

The Meta growth system already sends these CAPI identifiers — verify they're present on any new event integration:

- `email` (hashed)
- `phone_number` (hashed, when available — lower priority)
- `external_id` (customer_id or anonymous visitor_id)
- `ip_address`
- `user_agent`
- `fbc` / `fbp` cookies (captured client-side, included in server event)
- `event_id` (for dedup with pixel)

Adding `first_name_hash` + `last_name_hash` + `zip_hash` on purchase events pushes Purchase EMQ to 9.0+. Do this before any large scaling decision.

---

## 8. Pipeline capacity constraints

The order-processing pipeline is in `packages/pipeline/src/index.ts` with `PIPELINE_CONCURRENCY=20` by default.

| Metric | Current capacity | Alert threshold |
|---|---|---|
| Daily orders | ~100/day | Alert if 7-day avg > 80/day |
| Daily print orders (Lulu submission) | ~50/day | Alert if > 40/day |
| Gemini API concurrency | 20 parallel | Alert on rate limit 429s |
| Print fulfillment SLA | 72h to Lulu submission | Alert if any order >48h in `awaiting_print_submission` |

**Ad scaling check before pushing budget up:** if projected volume > 80 orders/day sustained, raise operational capacity FIRST (bump concurrency, increase Gemini rate limits, notify Lulu). Never push spend past capacity — results in customer-facing SLA misses.

---

## 9. Creator partnership overlay

Creator program runs parallel to paid Meta, not as a replacement. See `tasks/creator-discovery-brief.md` for full spec.

### Deal structure for decisions

- **Flat fee:** $500–1,500 upfront
- **Rev share:** tiered 25% / 30% / 35% based on attributed revenue
- **Attribution window:** 90 days via unique promo code
- **Content rights:** 12 months — we can whitelist their content as our own Meta ads
- **Creator CAC equivalent:** typically $13–18 (often lower than paid Meta blended)

### Whitelisted ad decisions

When running a creator's content as our ad (whitelisted from their handle):
- Use the creator's handle as the "From" — not our brand page. Delivers 2–3× better CTR.
- Apply same fatigue rules as any ad — rotate if frequency >2.0.
- Measure CPL + conversion separately from brand-page ads; blend for reporting but track channels distinctly.
- Rev share still applies on whitelisted performance (spell this out in the contract).

### When to stop paying a creator

- Their content underperforms both our branded creative AND other creators' content for 30 consecutive days
- Audience quality degrades (any suspicion of inflated followers — verify via engagement rate)
- Brand safety incident on their feed
- Repeat CAC > $25 (2× our blended target) across multiple campaigns

---

## 10. EU, international, seasonality

### Geographic targeting

- Primary: **US** (majority of volume)
- Secondary: **CA, UK, AU** (ship there, similar CAC)
- EU: **low priority** currently — physical shipping is feasible but DST fees apply (July 2026+). See `eu-compliance.md` if any campaign >20% EU delivery.

### Seasonality that affects bidding

| Period | Effect | Adjust how |
|---|---|---|
| **Late October → mid-December (holidays)** | CPMs +30–60%, conversion up | Budget up 2–3x; bid cap tolerant |
| **May (Mother's Day buildup)** | CPMs +20%, conversion up sharply | Push grandparent + mom segments |
| **June (Father's Day + early summer)** | Moderate uplift | Lean on dad segments |
| **January–February (post-holiday)** | CPMs drop, conversion drops | Budget down 40%; tune creative; test new segments |
| **Back-to-school (Aug)** | Teacher/school segment warms up | Bump OT/SLP/teacher creators |

Plan ad budget on a monthly cadence that respects this — flat budgets underperform.

---

## 11. Known risks / escalate-immediately triggers

When any of these happens, ESCALATE (don't auto-action):

1. **EMQ on Purchase falls below 7.0** — tracking broke somewhere; every downstream decision is unreliable
2. **Conversion rate drops >40% in 72h with no creative change** — something is broken upstream (sample pipeline, payment, email delivery)
3. **Gemini rate limit errors appearing on sample generation** — reduces QC pass rate, hurts sample-to-paid conversion
4. **Lulu API errors on cost-calculation or print submission** — print fulfillment broken, can't confirm real cost of goods
5. **CAC spikes 2x in a week without spend change** — audience saturation, competitor entering, or seasonality shift
6. **Any Meta policy flag on ad account, page, or domain** — stop all scaling decisions, investigate
7. **Creator partner drives <$500 revenue after $2000+ content spend** — deal is failing, pause and diagnose

---

## 12. Files to read when making LCB decisions

Code references the agent should know about:

| File | Why |
|---|---|
| `packages/shared/src/offers.ts` | Canonical pricing ladder |
| `packages/shared/src/lulu-cost.ts` | Cost formula; verify real cost not 40% placeholder |
| `packages/pipeline/src/index.ts` | Order pipeline behavior, capacity, retry ladder |
| `packages/pipeline/src/coloring-page-qc.ts` | Output quality gates — affects sample-to-paid conversion |
| `apps/web/lib/metrics.ts` | Dashboard math — what's being reported |
| `apps/web/lib/refund-tier.ts` | Refund logic using real Lulu cost |
| `apps/web/app/api/orders/[orderId]/quote-shipping/route.ts` | Lulu cost capture at quote time |
| `tasks/creator-discovery-brief.md` | Creator program ICP and deal structure |
| `tasks/meta-growth-system-plan.md` | The system this skill operates inside |

---

## 13. Decision defaults — Little Color Book overlay

When any of the generic skill's defaults conflicts with LCB operations, apply these overrides:

| Generic default | LCB override |
|---|---|
| "Default to Sales objective" | **Keep Sales — but land cold traffic on `/sample` while still optimizing on Purchase event. Leads objective only as a bootstrap when Purchase volume < 50/week.** |
| "40% Lulu cost placeholder" | **Never — use real API cost or formula from lulu-cost.ts** |
| "Flat CPA target" | **Tier-specific; pdf-30 gets the $10 target, print-100 tolerates $25+. Always track CPL AND CAC — both, always.** |
| "Scale when CPA stable" | **Scale when both CPL and CAC are healthy AND pipeline capacity has headroom. Never scale on CPL alone — tire-kickers don't pay bills.** |
| "Advantage+ Creative mix — 10 variants" | **Minimum 10, weighted toward UGC-style Reels with real photo-to-page transformation** |
| "One ad account" | **Separate pet vs family/kids creative into distinct ad sets — different audiences** |
| "Saturation = $30-50K/mo" | **No assumed ceiling. Market is large; detect saturation via the CPL/conversion/frequency signals in §3 before capping spend.** |

---

**This context file is living — update it when unit economics shift, when the funnel changes, when new constraints emerge. The skill uses these numbers for real decisions; stale numbers produce wrong decisions.**

**Last updated:** 2026-04-20
**Next review:** monthly or when meaningful metric shift
