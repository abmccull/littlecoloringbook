# Campaign: email-stack-v1

## Goal
Build the four-sequence lifecycle email system for Little Color Book on Resend. Convert free-sample subscribers into first-time buyers, turn first-time buyers into repeat-purchase keepsake customers, recover lapsed customers, and rescue abandoned checkouts — all in a voice that sounds like the capable mom friend, not a startup.

## Sequences

| Sequence | Audience | Emails | Window | KPI Target |
| --- | --- | --- | --- | --- |
| Welcome | Free-sample subscribers, unpurchased | 5 | 14 days | 45% open avg, 6% CTR, 4% first-purchase rate |
| Post-Purchase | Any paid customer (PDF or print), post-delivery | 5 | 60 days | 55% open avg, 12% reply/review rate, 8% second-book rate |
| Re-Engagement | 90+ days since last order | 3 | 10 days | 30% open avg, 3% reactivation rate |
| Abandonment | Stripe checkout started, expired unpaid | 3 | 3 days | 50% open avg, 15% recovery rate |

Total: 16 emails across 4 sequences.

## Angle
Primary: **Screen-Free Mom Win** — "Turn the photos already on your phone into a screen-free activity your kid will actually use and a keepsake you'll actually keep."
Supporting: *Personalized Without Becoming A Project* (objection handling in welcome + abandonment), *Giftable Keepsake From The Camera Roll* (post-purchase repeat + re-engagement).

## Audience Segment
Primary: moms of young kids, mobile-first (IG/TikTok acquisition), low-prep screen-free activity seekers, price-conscious but willing to pay for meaningful purchases.
Secondary: grandparents + gift-givers (print keepsake buyers).
Emotional job: solve "what should we do right now?" AND create "something worth saving or gifting later."

## Lead Magnet
Free sample page — customer uploads a photo, we generate one coloring page for them, delivered as a free PDF sample. Used as the bridge into the paid 30/50/100-page books.

## Paid Offer
- 30-page book: $24.99 PDF / $49 print
- 50-page book: $39 PDF / $54 print
- 100-page book: $59 PDF / $99 print (best-value keepsake anchor)

## Offer Codes (manually created in Stripe)
- `FIRSTBOOK10` — 10% off first book (welcome sequence, email 4)
- `REPEAT15` — 15% off second book (post-purchase, email 4)
- `COMEBACK20` — 20% off win-back (re-engagement, email 3)
- `FINISHORDER10` — 10% off finish-your-order (abandonment, email 3)

## Bridge Logic
- **Welcome:** they got a free sample page → prove the magic → invite them to turn the rest of the camera roll into a full book.
- **Post-Purchase:** they have a book in hand → give them ways to use it (activity ideas, gift moments) → natural ask for sibling copies, grandma copies, holiday gifts.
- **Re-Engagement:** they've been quiet 90 days → new season of photos, new reason to make a book → soft win-back offer.
- **Abandonment:** they were one click from done → remove friction, answer the "will this actually work?" question → small nudge.

## Timeline
Welcome: Day 0, 2, 5, 9, 14
Post-Purchase: Day 1 post-delivery, Day 5, Day 14, Day 30, Day 60
Re-Engagement: Day 0, 4, 10
Abandonment: Hour 1, Hour 24, Day 3

## ESP
Resend (connected, verified sender `hello@littlecolorbook.com`). Order-lifecycle transactional templates already wired in `packages/email/src/index.ts` — this campaign does NOT duplicate those.

## Status
draft

## Voice Notes
- Mobile-first every time. Assume iPhone inbox preview, thumb scrolling, 3 seconds of attention.
- Warm-direct tone. Short-to-medium sentences. Lead with outcome.
- Use family vocab: camera roll, screen-free, rainy afternoon, grandma copy, print tonight, quiet time, keepsake, giftable, easy yes, spiral book, sibling copy.
- Avoid: funnel, workflow, SKU, queued, pipeline, conversion, unlock, leverage, quality bar, proof step.
- Every email has ONE CTA. P.S. is prime real estate when used.
- No fake urgency. When a deadline is real (sample expiring, checkout expired), name it plainly.

## Send Times (Eastern Time default; adjust for subscriber timezone where available)
- B2C mom audience: Tuesday/Wednesday/Thursday 7:30-9:00 AM ET or 8:00-9:00 PM ET perform best.
- Weekend exception: Saturday 9:00-10:30 AM ET works for the post-purchase "rainy afternoon idea" email.
- Abandonment emails ignore this and send on relative triggers (hour 1, hour 24, day 3).

## HTML Notes
- Max width 600px.
- Single-column, mobile-first.
- No heavy CSS; inline styles only.
- No hero images required in MVP — copy does the work. Optional small logo lockup at top.
- Unsubscribe footer auto-appended by Resend on marketing sends (broadcasts + audiences).
- Transactional sends (abandonment — arguable) should go through the same `hello@littlecolorbook.com` sender for consistency.
