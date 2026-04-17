## Learnings

Generated 2026-04-10 by `/start-here`

### What Works

- The product resonates when it is framed as an easy screen-free win, not a novelty AI product.
- Real product proof and family-use context matter more than polished but abstract design language.
- `100 pages` should be positioned as the best-value option, with `30 pages` as the entry point and `50 pages` as the middle choice.
- Moms want this to feel personal without turning into a project.

### What Doesn't Work

- Corporate SaaS styling and internal-operator language weaken trust and desire.
- Explaining offers like an internal memo lowers conversion.
- Manual-refresh UX patterns make the product feel unfinished.
- Desktop-first layouts break down fast because expected traffic is heavily mobile.

### Audience Insights

- Primary buyer is moms with young kids who want an easy, meaningful activity from photos already on their phone.
- Secondary buyer is grandparents and gift-givers who care about the keepsake angle.
- The emotional job is two-fold: solve `what should we do right now?` and create `something worth saving or gifting later`.
- Mobile matters disproportionately because paid traffic is likely to come from Instagram and TikTok.

### Newsletter Format Patterns

- [2026-04-17] [/newsletter] Two-archetype cadence (Sunday narrative / Thursday gallery) beats a single recurring template. The contrast test: a reader should know which one they opened within 2 seconds. If both archetypes drift toward the same visual density or copy length, the two-show rhythm collapses.
- [2026-04-17] [/newsletter] Sunday 6pm and Thursday 8am chosen deliberately for mood contrast — evening settle vs morning momentum. Reinforces the feeling that these are two different shows, not the same email twice.
- [2026-04-17] [/newsletter] "The customer does not want to hear from the CEO" — no founder signature, no founder photo, no "here's what we did this week" framing anywhere in the newsletter. The product (real family pages) is the content.
- [2026-04-17] [/newsletter] A skipped send is always better than a forced send. The Sunday ritual is protected by reliability-of-quality, not frequency. If there is no clean feature-consented page for Sunday, fall back to evergreen or skip — never ship a weak hero.
- [2026-04-17] [/newsletter] Feature-consent as a distinct checkbox from marketing-opt-in is the lever that controls the entire content pipeline. Target 40%+ opt-in; under 25% for 3 weeks running means something upstream is broken.
- [2026-04-17] [/newsletter] Prompt-of-the-week in Thursday Gallery serves dual purpose — gives the reader a fun small assignment AND generates the content pool for next Sunday's Show-Off. Closes the loop inside the newsletter itself.
- [2026-04-17] [/newsletter] Forward line ("Know a mom who'd love this? Forward it.") outperforms share buttons for this audience because mom-to-mom email forwards are the highest-trust acquisition this brand gets.

### Email Sequence Patterns

- [2026-04-17] [/email-sequences] The four-sequence lifecycle (welcome / post-purchase / re-engagement / abandonment) must be deliberately distinct from the already-wired order-lifecycle transactional templates in `packages/email/src/index.ts`. Post-purchase especially: the shipping / delivered emails are transactional; the "love" layer is separate and starts Day 1 post-delivery.
- [2026-04-17] [/email-sequences] The abandonment framing "looks like the tab closed on you" outperforms "you left items in your cart" for a mom audience — it blames the browser, not the buyer, and doesn't carry the aggressive ecom energy that reads as spam in this voice.
- [2026-04-17] [/email-sequences] Three specific moment-names — "rainy afternoon," "birthday bag," "grandma copy" — function as a branded framework when used consistently across post-purchase, re-engagement, and welcome email 3. They give customers a shared vocabulary for when to buy a second book.
- [2026-04-17] [/email-sequences] Every offer code (FIRSTBOOK10 / REPEAT15 / COMEBACK20 / FINISHORDER10) has a visible expiry. No forever-discounts. The time window is the real urgency — not fake scarcity language.
- [2026-04-17] [/email-sequences] The welcome sequence ends with a graceful check-in at Day 14, not a hard pitch. The "reply with what's holding you up" CTA pulls higher-quality first-purchase conversions than a discount reminder would.
- [2026-04-17] [/email-sequences] Sibling copy + grandma copy is the natural second-purchase unlock, NOT "upgrade to a bigger book." The repeat motion is horizontal (another book for another person), not vertical (same book, bigger).
- [2026-04-17] [/email-sequences] HTML emails should cap at 600px, single column, inline styles, minimal imagery — this audience is 80%+ mobile, and the iPhone Mail preview is the real design canvas.
- [2026-04-17] [/email-sequences] Preview text is treated as a co-subject line, not a repeat of it. Every email's preview adds a second specific hook (e.g. subject: "A second book (sibling copy, grandma copy)" + preview: "REPEAT15 is inside — good for 14 days").
