# Email automation audit — 2026-04-20

**TL;DR:** Email sequence templates, cron dispatcher, and Stripe coupons are all wired correctly. **But not one email has ever been sent in production.** Root cause is upstream: the sample funnel itself is broken. 38 sample orders in prod, 0 with uploads, 0 generation jobs, 0 emails. Sequences can't enroll customers who never complete the sample flow. Fix the upload step before worrying about email.

---

## Scope

Verify what I claimed was "live" in the 2026-04-20 code review is actually working. I was partly wrong — the pieces exist, but the system has never transmitted a single message.

Methodology: read-only queries against prod Neon + Stripe. No writes, no sends.

Scripts for re-running:
- `scripts/audit-email-sequences.mjs` — prod DB counts + trigger coverage
- `scripts/audit-email-coupons.mjs` — Stripe promo code existence

---

## Findings

### ✓ What's working

1. **Templates exist** — `packages/email/src/sequences.ts` defines 16 emails across 4 sequences (welcome × 5, post_purchase × 5, re_engagement × 3, abandonment × 3). Clean HTML + text. Uses the "Little Color Book" Title Case signature.
2. **Enrollment helpers exist** — `apps/web/lib/sequence-enrollment.ts` exports `enrollInWelcome`, `enrollInPostPurchase`, `enrollInReEngagement`, `enrollInAbandonment`. All use the same `enrollCustomerInSequence` repository function.
3. **Enrollment call sites wired** —
   - `welcome` ← `apps/web/app/api/internal/jobs/process-sample/route.ts:56` (after sample job completes)
   - `post_purchase` ← `apps/web/app/api/webhooks/stripe/route.ts:106` (on `checkout.session.completed`)
   - `abandonment` ← `apps/web/app/api/webhooks/stripe/route.ts:248` (on abandoned checkout)
   - `re_engagement` ← `apps/web/app/api/cron/re-engagement-sweep/route.ts:21` (weekly Tue 4pm)
4. **Cron dispatcher live** — `/api/cron/email-sequences` every 15min (per `apps/web/vercel.json`) polls `email_sequence_states`, computes due steps, renders, calls `sendSequenceEmail`.
5. **Stripe promo codes all present and active:**
   - `FIRSTBOOK10` (10% off) ✓
   - `REPEAT15` (15% off) ✓
   - `COMEBACK20` (20% off) ✓
   - `FINISHORDER10` (10% off) ✓
   - 0 redemptions on all four (consequence of 0 sends)

### ✗ What's broken

**Master finding: zero emails have ever been transmitted.**

| Table | Rows |
|---|---|
| `email_sends` all-time | 0 |
| `email_events` all-time | 0 |
| `email_sequence_states` all-time | 1 (single abandonment enrollment) |

**Enrollment counts:**

| Sequence | Enrolled | Eligible customers | Coverage |
|---|---|---|---|
| welcome | 0 | 31 (with sample orders) | **0%** |
| post_purchase | 0 | (no paid orders) | n/a |
| abandonment | 1 | 8 draft non-sample orders >1h old (30d) | **12.5%** |
| re_engagement | 0 | 0 (too few paid customers, 30d+ inactive) | n/a |

### Root cause: the sample funnel is dead in prod

Sample orders (all-time):

| Status | Count |
|---|---|
| draft | 36 |
| preprocessing | 2 |
| *any completed state* | **0** |

Supporting data:
- 38 sample orders, **9 of the 10 most recent have 0 uploads**
- `processing_jobs` queue: **0 rows ever enqueued** for `process-sample`
- `generation_jobs` with `kind='sample'`: **0 rows**
- `email_events` with template `pdf-ready` (sample delivery): **0 rows**

**What this means:** Customers submit email + child's first name on `/sample`, which creates a draft `orders` row. They're then supposed to upload a photo. That second step is dropping ~90% of customers, which means the process-sample job never gets enqueued, which means no coloring page is generated, which means no sample-ready email, which means no welcome enrollment, which means the entire email automation surface has nothing to feed on.

**The two customers in `preprocessing` also never completed** — suggesting the pipeline has never run end-to-end against real traffic, not even for the power users who did upload.

---

## Secondary findings

1. **No sample-to-welcome enrollment pair exists** in 30d. Sample-to-welcome latency query returned zero rows.
2. **Re-engagement eligibility is zero** (0 paid customers whose last order is >30d old). Expected — the business is pre-launch for paid traffic.
3. **Abandonment trigger is too narrow.** Fires only on Stripe checkout session creation (line 248 of the webhook), which skips any order that never makes it to Stripe. With the upload flow broken, most draft orders never reach Stripe, so they never get an abandonment email even though they're the most valuable recovery target.

---

## Recommendations (ordered by severity)

### P0 — blocks ads launch

1. **Fix the upload step.** Before any ad spend, debug why 9 of 10 customers abandon before uploading a photo. Options to investigate:
   - Is the upload UI broken? Manually walk through `/sample` → upload → processing in a real browser on mobile + desktop.
   - Is there a pre-signed URL / GCS CORS misconfiguration silently failing?
   - Is the post-email-submission redirect to the upload page working?
   - Are there friction points (required fields, non-obvious CTA) that could be removed?
2. **Run 1 end-to-end test sample order** through the entire pipeline with a real photo. Confirm: upload → process-sample job → generation → pdf-ready email → welcome sequence step 1 enrollment.
3. **Add a synthetic monitor** — a cron that enqueues a dummy sample once an hour (or on deploy) and alerts if the order doesn't reach `pdf_ready` within 5 minutes. This is the canary that catches upload/generation regressions before customers do.

### P1 — improves email system once #1 is fixed

4. **Move welcome enrollment earlier.** Currently fires after `runProcessSampleJob` succeeds (`process-sample/route.ts:56`). If generation fails, the customer also loses the welcome sequence — which is the wrong failure mode (we still want to educate them). Enroll at sample order CREATION instead, or immediately after upload completes. The welcome sequence's step 1 already doesn't depend on sample content.
5. **Broaden the abandonment trigger.** Right now it only fires from the Stripe webhook (i.e., customers who reached Stripe). Enroll abandonment for any `orders` row that sits in `draft` for >1h with `order_type != 'sample'`. Add a cron that sweeps draft orders and enrolls them. The cart-abandon template ("Looks like the tab closed on you") already handles both the Stripe-reached and upload-stuck cases.
6. **Add sample-abandonment sequence** for customers who submitted email but never uploaded. These are the 90% majority. A 1-email nudge at 2 hours ("Want to try a different photo? Here's how to pick one kids love.") could recover a meaningful share.

### P2 — operational improvements

7. **Observability.** No dashboard exists for sequence state (active/completed/stopped by sequence, step distribution, send success rate, time-to-next-send). Add to `/admin/growth/email` or similar. Until that exists, the audit scripts in `scripts/audit-email-*.mjs` are the manual fallback.
8. **Test harness for sequences.** Add a "send to self" endpoint that renders each sequence+step with fake vars so the copy can be reviewed end-to-end without triggering real enrollments.
9. **Unsubscribe/suppression wiring.** Unsubscribe URL is `{{{RESEND_UNSUBSCRIBE_URL}}}` template-literal in footer (`sequences.ts:61`). Verify Resend is actually interpolating this; otherwise customers literally see the placeholder.

---

## What I was wrong about in the 2026-04-20 code review

I wrote that email automation was "live, 16 emails across 4 sequences, cron dispatches every 15 min." That's true of the code, but I did not check runtime state — which is zero messages ever transmitted. The plumbing exists. The water is off because the tank upstream is empty.

Corrected characterization: **email sequences are fully wired but cannot run until the sample funnel delivers a customer who completes a generation cycle. Fixing the sample upload flow is the prerequisite, not a separate task.**
