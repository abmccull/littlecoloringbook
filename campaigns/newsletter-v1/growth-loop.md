# Growth Loop — How the Newsletter Compounds the List

Generated 2026-04-17 by `/newsletter`

---

## The Core Idea

The newsletter doesn't just inform the list — it grows the list. Every send should do at least one thing that expands either the reach or the feature pool. Over a quarter, those small loops compound.

Four loops. One list that gets bigger, warmer, and more content-rich every week.

---

## Loop 1 — The Forward Line

### What it is

Every send ends with one single line above the footer:

```
Know a mom who'd love this? Forward it.
```

No button. No "share this email." No social icons. Just a sentence a reader can act on with two taps (forward, type an address, hit send).

### Why it works

Forwards from mom to mom are the highest-trust acquisition this brand will ever get. A cold ad from Instagram costs money. A forward from her best friend costs nothing and converts at a multiple.

### What to measure

- Forward rate per send (target: 2%+ Sunday, 1%+ Thursday)
- New subscribers who list "a friend forwarded it" as their signup reason
- Organic new subscribers arriving within 24h of a send

### What to iterate

Test the line itself over a quarter. Variants:

```
1. "Know a mom who'd love this? Forward it."
2. "Forward this to the mom who always has the camera out."
3. "Send this to your mom group chat."
4. "Know a grandma who'd love it? Forward it."
5. "One forward > one ad."
```

---

## Loop 2 — The Feature-Consent Checkbox

### What it is

A second checkbox on the post-purchase thank-you page (details in `content-pipeline.md`) that lets the customer opt in to having their pages featured in the newsletter gallery.

```
[ ] It's okay to show my coloring pages in our
    newsletter gallery. (We never use last names,
    cities, or ages beyond approximate.)
```

### Why it works

Every percentage point of feature-consent opt-in is a percentage point of future Sunday Show-Offs and Thursday Galleries. The feature pool IS the content engine. A small feature pool means repeats, evergreen fallbacks, or skipped sends. A large feature pool means fresh families every week.

### Target

**40%+ opt-in on the feature-consent checkbox at post-purchase.**

### Why 40% is realistic

- The marketing opt-in typically runs 60-70% for a warm post-purchase moment
- Feature-consent is higher-commitment (showing my kid's page to strangers), so expect it to run 30-45%
- Framing matters enormously — see the copy in `content-pipeline.md`
- Families who bought the product are already proud of the output

### What to measure

- Opt-in rate on the feature-consent checkbox (weekly)
- Feature pool size (rolling 30-day: how many unique customers are eligible)
- Repeat-family rate (what % of monthly features are repeats)

### What to iterate

If opt-in rate falls below 35%, test:

- Reordering the checkboxes (feature-consent first, marketing second)
- Adding a small preview ("See recent examples →" link)
- A/B the reassurance copy ("We never use last names...")
- Pre-checking the box (tread carefully — consent must feel opt-in)

---

## Loop 3 — The Prompt of the Week

### What it is

The Thursday Gallery ends with one themed photo prompt ("Take a photo of your kid doing their favorite messy thing") and a CTA to upload it. Customers who upload a prompt photo become candidates for next Sunday's featured family and the following Thursday's gallery.

### The flow

```
Thursday  :  Prompt goes out. "Take a photo of the messy thing."
Weekend   :  Customer takes the photo. Uploads to Little Color Book.
Monday    :  Their page renders through the pipeline.
Next Sunday: Their family might be this week's Show-Off.
```

### Why it works

- The reader gets a small, fun assignment — not a sales pitch.
- The brand gets a pipeline of recent, thematically consistent photos.
- A featured family in Sunday Show-Off creates a "wait, that's me!" moment that almost always gets forwarded (see Loop 1).
- The prompt becomes the theme of that week's gallery two Thursdays later — "Here are the muddy boots we got!" — closing the loop for the reader.

### What to measure

- Upload rate on prompt days vs non-prompt days
- % of Thursday Gallery pages that came from the previous prompt
- % of Sunday Show-Off features that came from a prompt upload in the last 14 days

### What to iterate

Track which prompts generate the most uploads (and by how much). The bank of 12 in `copy-patterns.md` is v1; after one full quarter, re-rank by upload volume and retire the bottom four.

---

## Loop 4 — Seasonal Rotation

### What it is

The pipeline is aware of the calendar. Real moments that matter to moms get their own sends or themed prompts, not just "weekly Sunday, weekly Thursday."

### The calendar

| Window | Sunday theme | Thursday prompt |
| --- | --- | --- |
| 2 weeks before Mother's Day | Feature a grandma+kid family | "Take a photo with your mom, or your kid's grandma" |
| First week of August | Feature a "last summer weekend" family | "Take a photo from the last unbothered weekend of summer" |
| First day of school week | Feature a first-day photo | "Take the first-day-of-school photo. It's a classic for a reason." |
| Birthday cluster (customer-triggered) | Skip — trigger birthday send separately | — |
| Week of Thanksgiving | Feature a "whole family" scene | "Take a photo at the table. Or the aftermath." |
| Early December | Feature a holiday-card alternative | "Take the holiday-card photo. Or the one you wish you could send." |
| First week of January | "Quiet month" feature, pets + blankets | "Take a photo of their quietest happy moment" |

### Why it works

- Moms are already thinking about these moments. The newsletter meets them where their attention is.
- Seasonal prompts produce naturally themed galleries (a Thursday wall of first-day-of-school pages is ten times more shareable than a random gallery).
- Birthday and holiday sends naturally have higher conversion intent — readers are already in gift-buying mode.

### What to measure

- Open-rate lift on seasonal sends vs baseline
- Upload lift on seasonal prompts vs baseline
- Conversion rate on seasonal sends (which probably includes a softer-than-usual purchase nudge)

### What to iterate

After year 1, the calendar becomes data-driven: what sent well last Mother's Day gets the slot again, with one tweak.

---

## Secondary Signals

Things that are not core loops but still compound:

- **Pre-checked subscriber-referral code.** Every subscriber has a unique forward-friendly link. We don't build a full referral program on day one — the organic forward line (Loop 1) is simpler — but add it in v2 if forward rate is healthy.
- **Featured-family alumni list.** Customers who've been featured get a one-time "you were featured this Sunday — here's your link" email. They almost always share it. This is free, warm, high-social-proof distribution.
- **Evergreen library audit.** Every quarter, review the evergreen library. Remove pages where consent was revoked. Add new top performers. The library is the backup engine — treat it like one.

---

## What Would Break the Loop

Things to watch for and shut down fast:

- **Over-sending.** Two per week is the cap. A "third send" for a promo or launch has to replace a regular send, not add to it. Adding a third send breaks the two-show rhythm.
- **Silent template drift.** If Sunday and Thursday start converging visually, the contrast vanishes. Audit every 8 weeks: hold a Sunday and a Thursday side by side — do they fail the two-second test?
- **Feature-pool burnout.** If feature-consent opt-in drops below 25% for 3 weeks, something upstream is broken. Investigate checkbox copy, placement, and timing.
- **Caption drift.** If the auto-generated Sunday captions start reading like a template ("This is {name}, {age}. Her mom uploaded..." every single week), test variant caption templates from `copy-patterns.md`. The voice must stay warm, not mechanical.

---

## North-Star Metric

Not open rate. Not click rate.

**The north-star for this newsletter is:** "A customer who got featured in Sunday Show-Off forwarded the email to someone, and that someone bought within 30 days."

That's the whole loop in one event. Every other metric is downstream of that happening repeatedly.
