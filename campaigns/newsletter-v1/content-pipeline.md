# Content Pipeline — Auto-Selection Logic

Generated 2026-04-17 by `/newsletter`

---

## Goal

A weekly cron picks which family and which pages get featured in each send. Zero human curation step in the happy path. One human review window (24h admin preview) lets Alec pull a send before it goes out if anything looks wrong.

---

## The Three Feature Flags (on `customers`)

Every decision in this pipeline depends on three booleans on the customer row. Two already exist. The third is a proposal.

| Flag | Source | What it gates |
| --- | --- | --- |
| `marketing_opt_in` | checkout checkbox (existing) | Can this customer receive the newsletter at all |
| `feature_consent` | **proposed new flag** — see below | Can we feature this customer's pages in newsletters |
| `child_name_consent` | **proposed new flag** — see below | Can we use the child's first name in copy |

### Proposed: `feature_consent` checkbox

Add a second checkbox to the post-purchase thank-you page, directly under the marketing opt-in:

```
[ ] Email me when my pages are ready and occasional
    coloring-book news. (We send 2 emails a week.)

[ ] It's okay to show my coloring pages in our
    newsletter gallery. (We never use last names,
    cities, or ages beyond approximate.)
```

Default state: unchecked. Opt-in must be deliberate. Target: 40%+ opt-in rate on this second checkbox (see `growth-loop.md`).

### Proposed: `child_name_consent` checkbox

Appears only if `feature_consent` is checked. One additional checkbox:

```
    [ ] It's okay to use my child's first name in
        the caption (e.g., "Mila, almost 4").
```

If unchecked, Sunday Show-Off uses a generic fallback ("This week's family" or "A favorite from Seattle-ish" — region-blurred if we want warmth, generic if we don't).

---

## Sunday Show-Off Selection

### The Pick

One family. Chosen every Sunday at 10am for a 6pm send.

### Selection Query (conceptual)

```
SELECT a page to feature WHERE:
  - order.status = 'delivered'
  - order.delivered_at BETWEEN (today - 7 days) AND today
  - customer.marketing_opt_in = true
  - customer.feature_consent = true
  - page.qa_score >= 0.85      (top tier only)
  - page NOT IN last_28_days_featured_pages
  - customer NOT IN last_56_days_featured_customers

ORDER BY page.qa_score DESC
LIMIT 1
```

### The Story

The 2-3 sentence caption is auto-drafted from structured order metadata, not from free-text customer input:

```
This is {firstName}, {approxAge}. {possessive}
{adultLabel} uploaded this photo from
{momentContextTag}. The page arrived in {possessive}
{packageSize}-page book {relativeDeliveryDay}.
```

Variables come from:
- `firstName` — from `child_name_consent` (else "This week's family")
- `approxAge` — rounded ("almost 4," "toddler years," "turning 7"). If no age data, skip.
- `adultLabel` — defaults to "mom" (this is the brand default audience); admin can flip to "dad" or "grandma" if known
- `momentContextTag` — one of a curated tag set the customer selected during upload ("a rainy-day walk," "backyard bubbles," "birthday morning," etc.). If no tag, fall back to "a favorite photo from their camera roll."
- `packageSize` — 30 / 50 / 100
- `relativeDeliveryDay` — "last Tuesday," "last weekend," etc.

### Fallback Cascade

```
If zero qualifying pages in last 7 days:
  → widen window to last 14 days
  → if still zero: use evergreen library (admin-curated,
    pre-consented) and label send as "From the archive"
  → if evergreen empty: SKIP the send. Notify Alec.
```

Do not send a Sunday Show-Off with a page that doesn't clear QA or consent. A weak send erodes the show-up-every-Sunday trust more than a skip does.

---

## Thursday Gallery Selection

### The Pick

Four to six pages. Chosen every Thursday at 3am for an 8am send.

### Selection Query (conceptual)

```
SELECT pages to feature WHERE:
  - order.delivered_at BETWEEN (today - 14 days) AND today
  - customer.marketing_opt_in = true
  - customer.feature_consent = true
  - page.qa_score >= 0.80
  - DISTINCT customer (no family appears twice in one gallery)
  - page NOT IN last_14_days_featured_pages
  - customer NOT IN last_28_days_featured_customers

ORDER BY page.qa_score DESC
LIMIT 6
```

### Diversity Rules

- No two pages from the same family in one send.
- No two pages with the same primary subject (if metadata allows this tag — e.g., don't ship a gallery of six dogs).
- Mix of subjects when possible: kid solo, sibling, pet, family scene.
- If the live pool skews one way, pad with evergreen pages to maintain the mix.

### Fallback Cascade

```
If fewer than 4 qualifying pages:
  → pad with evergreen library until count = 6
  → if evergreen can't reach 4 total: SKIP the send.
    Notify Alec.
```

### Evergreen Library Requirement

Maintain 20+ pre-approved evergreen pages at all times. These are admin-curated from top-performing, fully-consented past customers. They rotate in for holiday sends, low-volume weeks, and fallbacks. See `./brand/assets.md` — evergreen pages should be registered there as live assets.

---

## Child-Name and PII Redaction Rules

Hard-coded at the render layer. No exceptions.

| Field | Rule |
| --- | --- |
| First name | Only if `child_name_consent = true`. Else generic. |
| Last name | Never shown. Period. |
| Exact age | Never shown. Use rounded approximations only ("almost 4"). |
| City / state | Never shown. |
| School / daycare name | Never shown. |
| Photos of faces | Always allowed in Sunday (it's the whole point). Thursday Gallery uses the coloring page, not the original photo. |
| Original photos | Only rendered in Sunday Show-Off. Never in Thursday Gallery. Never in footer or sidebar. |

---

## Consent Revocation

If a customer:
- unsubscribes from marketing → `marketing_opt_in` flips to false → they stop receiving newsletters. Past sends stay intact.
- revokes feature consent (via a link in the footer of every send, or a reply-with-"remove") → `feature_consent` flips to false → any page of theirs is removed from future sends and from the evergreen library within 24 hours. Past sends cannot be recalled but are scrubbed from archived web versions.

The footer on every newsletter includes:

```
Featured in this send and want to come out?
Reply "remove me" and we'll pull your pages.
```

---

## Admin Preview Window (the one human checkpoint)

Every scheduled send is rendered and emailed to Alec 24 hours before the customer send. One email. Includes:

- The full rendered newsletter (exactly as subscribers will see it)
- The three subject line variants with the A/B split recommendation
- A one-line "Selection summary" noting which family, which pages, which QA scores
- A one-click "Pull this send" link that cancels the scheduled send

If Alec doesn't touch it in 24h, the send ships automatically.

This is the ONLY manual step. It exists specifically so:
- A borderline-awkward photo can be pulled (kid in a diaper, a family pet that died last month, etc.)
- A consent edge case can be resolved before it becomes a complaint
- A voice-drift in the auto-generated caption can be caught

If Alec pulls a Sunday send, the pipeline re-runs with the next-best candidate and issues another 24h preview. A Thursday pull falls back to the evergreen pool immediately (no re-preview required — lower stakes).

---

## Send Schedule (reference)

```
Sunday
  10:00am  Cron picks this week's family
  10:05am  Renders the Sunday email + generates subject variants
  10:10am  Sends admin preview to Alec
  Sunday next day 6:00pm  Ships (unless Alec pulled it)

Thursday
  Thursday - 1 day, 3:00am  Cron picks this week's six pages
  3:05am   Renders the Thursday email
  3:10am   Sends admin preview to Alec
  Thursday 8:00am  Ships (unless Alec pulled it)
```

---

## Zero Qualifying Content — What Happens

| Situation | Sunday action | Thursday action |
| --- | --- | --- |
| Live pool healthy (5+ candidates) | Normal send | Normal send |
| Live pool thin (1-4 candidates) | Normal Sunday, widen to 14d | Pad with evergreen |
| Live pool empty | Evergreen, label "From the archive" | Evergreen, label "Favorites from the archive" |
| Evergreen also empty | **Skip.** Notify Alec. | **Skip.** Notify Alec. |

A skipped send is always better than a forced send. The subscriber's Sunday-night ritual is protected by reliability of quality, not frequency.

---

## Summary of Proposed DB Changes

For the engineering handoff (this is a strategy doc, not a code doc — spelled out here just so it's clear what the pipeline depends on):

```
customers table:
  + feature_consent          boolean, default false
  + child_name_consent       boolean, default false

generation_pages table (already exists):
  ✓ qa_score                 already present per brief
  + featured_in_send_id      nullable FK, tracks reuse

orders table:
  + moment_context_tag       nullable string, customer-selected
                             at upload (e.g., "rainy-day-walk")
```

Engineering will implement these. This doc exists to make the product and consent behavior clear before code lands.
