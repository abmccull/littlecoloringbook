# Archetype B — Thursday Gallery

Generated 2026-04-17 by `/newsletter`

---

## The Feel

This is NOT Sunday Show-Off with a different photo. This one snaps. Visual first. Copy lean. Almost zero story.

Thursday 8am. Reader is on the school-run scroll, half-awake, coffee in hand. This email should feel like opening the camera roll of a bunch of families you know — a quick visual refresh, then one crisp call to action before the phone goes back in the bag.

Visual density: **high**. Copy length: ~90 words total. Tone: snappy, bright, confident.

Where Sunday is slow and warm, Thursday is quick and fun.

---

## The Contrast Test

If you hold Sunday Show-Off and Thursday Gallery next to each other, they must fail the "same email" test in two seconds flat:

| | Sunday Show-Off | Thursday Gallery |
| --- | --- | --- |
| Hero | one split image | grid of 4-6 images |
| Copy length | ~180 words | ~90 words |
| Headline style | narrative ("This week's page...") | declarative ("This week's camera roll") |
| Voice | settled, warm, story | quick, bright, snappy |
| CTA | one soft sidebar | one inline button |
| P.S. | small-wins number | none (or one prompt line) |
| Feel | Sunday night episode | Thursday morning photo wall |

---

## The Template

### Subject Line Slot

Snappy. Declarative. Often plural. Avoid the "This week's page" pattern from Sunday.

```
① {number} pages. Zero screens.
② This week's camera roll, coloring-book edition
③ Your Thursday gallery is up
```

Examples:

- "6 pages. Zero screens."
- "This week's camera roll, coloring-book edition"
- "Your Thursday gallery is up"

More variants in `copy-patterns.md`. Subject lines must be visibly different from Sunday — no "this week's page," no single-child naming.

### Preheader

One line. Punchy.

```
Plus a prompt of the week — take the photo tonight.
```

Or:

```
{number} finished pages from real camera rolls.
```

### Hero Grid

A tight grid. No captions. No borders. Let the pages breathe.

**Desktop (2 columns x 3 rows):**

```
┌──────┬──────┐
│ page │ page │
├──────┼──────┤
│ page │ page │
├──────┼──────┤
│ page │ page │
└──────┴──────┘
```

**Mobile (1 column x 6):**

```
┌──────────┐
│   page   │
├──────────┤
│   page   │
├──────────┤
│   page   │
└──────────┘
   (etc.)
```

Six pages is ideal. Four is the floor. Never fewer — if the pipeline can't find four qualifying pages, the send falls back to the evergreen library or skips entirely (see `content-pipeline.md`).

Each image sized 1:1 at 375px minimum. Clean line art on white. No frames, no labels, no family names.

### Micro-Headline Above the Grid

One line. Sentence case.

```
This week's camera roll, turned into pages.
```

Or:

```
Six favorites from this week's uploads.
```

### Prompt of the Week Card

A single themed card under the grid. This is the one piece of content in this email that isn't a product shot. It's the engagement hook.

```
┌────────────────────────────────────────────┐
│                                            │
│   PROMPT OF THE WEEK                       │
│                                            │
│   Take a photo of your kid doing their     │
│   favorite messy thing — mud, paint,       │
│   spaghetti sauce, the works.              │
│                                            │
│   We'll turn it into a page.               │
│                                            │
│   [ Upload your prompt photo → ]           │
│                                            │
└────────────────────────────────────────────┘
```

**Prompt bank (rotates weekly, 12 prompts = one full quarter):**

```
1.  Messy thing — mud, paint, pasta sauce
2.  The face they make when they're focused
3.  Their favorite outdoor place
4.  A photo of them and their grandma
5.  The exact moment before a tantrum
6.  Siblings being uncharacteristically nice
7.  Their "I built this" proud moment
8.  Pet and kid in the same frame
9.  A bath-time photo (PG, obviously)
10. The costume they wear at home every day
11. Back-of-the-head shots in a favorite spot
12. A car-seat nap
```

Prompts serve two jobs: they give the reader a small assignment (fun), and they feed next Sunday's pool of featured families (strategic). See `growth-loop.md`.

### Try This Tonight CTA

Inline button, under the prompt. One line of copy.

```
Grab the photo tonight. Upload it this weekend.

[ Start with a sample → ]
```

Alternate copy (rotate):

```
- Turn your favorite photo into a page →
- See yours in the next gallery →
- Make a page from tonight's photo →
```

### Shop Link Footer

One quiet line at the bottom, above the unsub. No hard sell.

```
Shop spiral books in 30, 50, or 100 pages →
```

That's it. No size comparison chart. No "most popular" badge. Thursday is a gallery, not a catalog.

### Footer

```
Know a mom who'd love this? Forward it.
```

---

## Full Example (Thursday, May 7, 2026)

```
Subject:   6 pages. Zero screens.
Preheader: Plus a prompt of the week — take
           the photo tonight.

────────────────────────────────────────

  This week's camera roll, turned into pages.

  ┌──────┬──────┐
  │ page │ page │
  ├──────┼──────┤
  │ page │ page │
  ├──────┼──────┤
  │ page │ page │
  └──────┴──────┘

  ┌────────────────────────────────────────┐
  │ PROMPT OF THE WEEK                     │
  │                                        │
  │ Take a photo of your kid doing their   │
  │ favorite messy thing — mud, paint,     │
  │ spaghetti sauce, the works.            │
  │                                        │
  │ We'll turn it into a page.             │
  │                                        │
  │ [ Upload your prompt photo → ]         │
  └────────────────────────────────────────┘

  Grab the photo tonight. Upload it this weekend.

  Shop spiral books in 30, 50, or 100 pages →

  ─────────────

  Know a mom who'd love this? Forward it.
  Unsub here. Little Color Book. Made for moms.
```

---

## Why This Archetype Works

- **Visual dopamine.** A grid of pages is scroll-friendly and shareable. Readers screenshot it.
- **Low-commitment open.** The reader doesn't need to invest 90 seconds of reading — they can skim the grid in six seconds and still feel value.
- **UGC loop.** The prompt of the week creates the next Sunday's featured family. It's a content engine disguised as a fun activity (see `growth-loop.md`).
- **Breathing room between Sundays.** Thursday reminds the reader the product exists without re-running the Sunday emotional beat three days later.

---

## Off-Brand Failure Modes (Do Not Write)

```
✗ "Here are this week's most popular pages!" — "popular" is metric-language, not voice
✗ "Our AI generated 6 stunning pages" — operator speak
✗ Family names or stories under any grid image — that's Sunday's job
✗ More than one CTA button above the prompt card — this email does one thing
✗ "Unlock the prompt of the week" — banned verb
✗ A size comparison chart — this is a gallery, not a pricing page
✗ Gifs, countdown timers, or promo codes — wrong register
```
