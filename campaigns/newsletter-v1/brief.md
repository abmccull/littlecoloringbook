# Newsletter v1 — Strategy Brief

Generated 2026-04-17 by `/newsletter`

---

## The Job

Build a marketing newsletter that runs fully on autopilot, sends twice a week, and makes customers excited to open it. The product itself (personalized coloring pages from real family photos) is the content. Every edition is powered by live customer output — not founder commentary, not "here's what we shipped this week" energy.

A reader should never think, "oh, it's another brand email." They should think, "oh, it's Sunday — let's see whose family got featured."

---

## Audience

**Primary.** Moms of young kids. Phone-heavy. Acquired via Instagram and TikTok. Want low-prep, screen-free wins. Resist anything that feels like a craft project or a startup newsletter.

**Secondary.** Grandparents and gift-givers who care about the keepsake angle.

**When they open.**
- 8-10pm (kids asleep, scrolling on the couch)
- 7-9am (before school run)

60%+ on mobile. Hero images must work at 375px wide.

---

## Voice Filter

Warm, bright, specific, premium, parent-real. The capable mom friend, not the CEO. Outcome first. Ease plus emotion. Never "unlock," "supercharge," "level up." No exclamation-point spam. No AI or pipeline talk.

Full voice at `./brand/voice-profile.md`.

---

## The Two-Archetype System

The whole point of this brief: two sends per week must feel like **different shows on different nights**, not the same template with fresh pictures. A reader should know which one they opened within two seconds of it appearing in the inbox.

### Archetype A — Sunday Show-Off

**Sunday 6pm local.** The main event.

One family. One story. The original photo, the finished page, and a 2-3 sentence story about who they are and why this page matters to them. Feels like a weekly episode of a show the reader is now following.

Visually: one big hero (photo-to-page split), lots of whitespace, longer copy, emotional payoff.

### Archetype B — Thursday Gallery

**Thursday 8am local.** The snacky one.

A 4-6 page grid of the best pages from the past two weeks (different families), a themed prompt of the week, one soft CTA. No story. Feels like a photo wall refresh.

Visually: dense image grid, short copy, one-word captions, punchy hook.

### Why Two Archetypes (and Not One)

One template sent twice a week fatigues fast. A reader who opens Sunday Show-Off three weeks in a row starts skipping Thursday Gallery if it looks the same — they think they've already seen it.

Two distinct shapes means:
- Two shots at getting opened each week
- Higher unsubscribe resistance (different value promises)
- The calendar teaches the reader to expect something different on each day
- Each archetype can evolve independently based on open and click data

---

## Cadence

| Day | Time | Archetype | Cap on copy | Hero format |
| --- | --- | --- | --- | --- |
| Sunday | 6:00pm local | Show-Off | ~180 words | Split hero (photo / page, 1:1) |
| Thursday | 8:00am local | Gallery | ~90 words | 2x3 grid (or 2x2 + prompt card) |

Sunday 6pm: readers are settling in for the week, kids are winding down, phone opens spike. Thursday 8am: morning scroll before the school run. Those two slots were chosen for contrast — one is evening reflection, one is morning momentum. That rhythm reinforces the feeling that these are two different shows.

---

## Content Sources

Everything pulls from live product data. No manual curation beyond the admin preview window.

- **`generation_pages`** — the rendered coloring page, its QA score, its generation time
- **`orders`** — who bought, what size, when it shipped
- **`customers`** — marketing opt-in status, feature-consent flag (new — see `content-pipeline.md`), first name (child's first name only)
- **Evergreen library** — 20+ admin-curated pages with pre-approved consent, used as fallback when live content is thin

Full selection logic in `content-pipeline.md`.

---

## KPIs

| Metric | Sunday Show-Off target | Thursday Gallery target |
| --- | --- | --- |
| Open rate | 48%+ | 42%+ |
| Click rate | 5%+ | 3%+ |
| Forward rate | 2%+ | 1%+ |
| Unsubscribe per send | <0.3% | <0.3% |
| Feature-consent opt-in at checkout | — | 40%+ (program-wide) |

Benchmarks assume a warm list (recent customers plus newsletter-only signups). If opens sit below target for 2 weeks straight, re-evaluate subject line patterns before blaming send time.

---

## What This Newsletter Is NOT

- Not a "founder update"
- Not a "here's what we did this week" corporate recap
- Not a product-announcement channel (new sizes, holiday promos, etc. get their own sends)
- Not a coloring-page dump with no context
- Not written by or about Alec

The customer does not want to hear from the CEO. They want to see beautiful personalized pages of families like theirs and feel that easy yes again.

---

## Files in This Campaign

```
./campaigns/newsletter-v1/
├── brief.md                          — this file
├── archetype-a-sunday-show-off.md    — Sunday template + copy
├── archetype-b-thursday-gallery.md   — Thursday template + copy
├── content-pipeline.md               — auto-selection logic
├── copy-patterns.md                  — subject line + opener + P.S. bank
└── growth-loop.md                    — how the newsletter compounds
```
