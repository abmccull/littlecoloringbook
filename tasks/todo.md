# TODO — Red Flag Remediation + Phase 2/3/4 Build-out

**Drafted:** 2026-04-20
**Owner:** Claude (engineering) + Alec (items marked USER)
**Source:** Red flags from 2026-04-20 code review + user direction

---

## Correction to the 2026-04-20 Code Review

One finding in the review was **wrong** and one needs a rewrite:

- **Red flag #6 "No email automation sequences deployed"** — INCORRECT. Sequences are live:
  - `packages/email/src/sequences.ts` — 16 emails across welcome (5), post_purchase (5), re_engagement (3), abandonment (3)
  - `apps/web/lib/sequence-enrollment.ts` — enrollment logic
  - `apps/web/app/api/cron/email-sequences/route.ts` — dispatcher, runs every 15 min
  - `apps/web/app/api/cron/re-engagement-sweep/route.ts` — weekly Tuesday 4pm
  - Enrollment called from Stripe webhook + process-sample route
  - Action: No work required. Just verify deliverability + enrollment rates in a follow-up audit (bundled into item #6 below).

- **Red flag #7 "Branding inconsistency"** — taxonomy itself says `brand.name: "little color book"` (correct). User says taxonomy is incorrect for a different reason (TBD during execution; likely the persona list — AGENTS.md approves 6 personas, taxonomy lists 14).

---

## Items Addressed in This Plan

| # | Item | Owner | Approach |
|---|---|---|---|
| 1 | Migration drift (0026/0027 never applied) | Claude | CLI-based local migration apply + verification scripts |
| 2 | No real social proof | USER (not in plan) | User handles |
| 3 | Print fulfillment untested end-to-end | USER | User handles |
| 4 | APP_URL canonical fragility | Claude | Startup assertion + doc |
| 5 | Value stack bonuses not rendered | Claude | Wire into `/sample/[token]` + upsell pages |
| 6 | Email automation verify | Claude | Audit enrollment + deliverability (not rebuild) |
| 7 | Campaign taxonomy incorrect | Claude | Reconcile taxonomy vs AGENTS.md canonical lists |
| P2 | Phase 2 — Kling AI video gen | Claude | Implement client + brief→video pipeline |
| P3 | Phase 3 — Publishing orchestration | Claude | Flesh out organic + paid scheduler + Reels/Stories |
| P4 | Phase 4 — AI agent control plane | Claude | Implement context/propose/execute/journal endpoints |

---

## 1. DB migrations — CLI-driven apply + verify

**Problem:** Migrations 0026 + 0027 existed in repo but were never applied to prod on 2026-04-20, breaking the sample funnel with `column "occasion" does not exist` errors. `drizzle-kit db:push` fails in non-TTY environments; ad-hoc `apply-migration-NNNN.mjs` scripts are easy to forget.

**Plan:**
- [x] Add a `_lcb_migrations` tracking table (created lazily on first run of apply/verify/bootstrap)
- [x] Write `scripts/migrate-apply.mjs` — reads `packages/db/drizzle/*.sql` in order, compares sha256 to applied list, applies missing ones statement-by-statement, records hash + timestamp. Idempotent. Detects sha drift on previously-applied files.
- [x] Write `scripts/migrate-verify.mjs` — three-way check: (1) all files applied, (2) no sha drift, (3) critical columns exist on live DB. Exit codes: 0 clean, 1 pending, 2 drift.
- [x] Write `scripts/migrate-bootstrap.mjs` — one-time seed for existing prod (refuses to seed if critical columns missing).
- [x] Add root package.json scripts: `db:migrate:apply`, `db:migrate:verify`, `db:migrate:bootstrap`
- [x] Add to `LAUNCH_CHECKLIST.md`: run `db:migrate:verify` before every prod deploy
- [x] Delete the one-off `scripts/apply-migration-0028.mjs`
- [x] Update `tasks/lessons.md` with the new workflow (2026-04-20 update block appended)
- [x] Run `npm run db:migrate:bootstrap` against prod — seeded `_lcb_migrations` with 29 rows (2026-04-20).
- [x] Run `npm run db:migrate:verify` against prod — exit 0, all 29 applied, all critical columns present (2026-04-20).
- [x] Run `npm run db:migrate:apply` — confirms no-op when nothing pending.

**Verification:** Parser tested against 0014 (33 stmts), 0017 (16), 0026 (1), 0028 (6). All three scripts pass `node --check` AND execute cleanly against prod. Tracking table is live.

---

## 4. APP_URL canonical guardrail

**Problem:** On 2026-04-20, `APP_URL=https://littlecolorbook.com` (apex) + Vercel's apex→www 301 redirect stripped Authorization headers on internal-HTTP job dispatch → silent 401s. Mitigated by updating APP_URL to www, but nothing prevents a regression.

**Plan:**
- [x] Add `getAppUrlEnv()` + `assertAppUrlAtBoot()` in `packages/shared/src/env.ts`. In production: requires https://, rejects hostname mismatch vs `APP_URL_CANONICAL_HOST`. Normalizes trailing slash.
- [x] Wire `assertAppUrlAtBoot()` into `apps/web/instrumentation.ts` (Next.js boot hook; runs before any route handler).
- [x] Refactor `apps/web/lib/stripe.ts` `getAppUrl()` to use the shared normalized value.
- [x] Add `APP_URL_CANONICAL_HOST` to `.env.example` with explanation.
- [x] **Fixed root cause of 2026-04-20 incident:** `scripts/push-vercel-env.sh` was hardcoding `APP_URL=https://littlecolorbook.com` (apex) for production — the exact config that broke internal-HTTP job dispatch. Changed to `https://www.littlecolorbook.com` + auto-pushes `APP_URL_CANONICAL_HOST=www.littlecolorbook.com` in production.
- [x] Smoke tested: apex rejected, www accepted + normalized, http rejected in prod, localhost accepted in dev.
- [x] `npm run typecheck` passes across all workspaces.
- [ ] **USER ACTION:** set `APP_URL_CANONICAL_HOST=www.littlecolorbook.com` in Vercel production env (once). Either via `./scripts/push-vercel-env.sh production` or `cd apps/web && vercel env add APP_URL_CANONICAL_HOST production` with value `www.littlecolorbook.com`. Next deploy will then fail fast if APP_URL ever drifts back to the apex.

**Verification:** Smoke tested manually (all 4 cases). Typecheck green. The runtime `redirect: "manual"` guard in `internal-jobs.ts:94-107` remains as a second line of defense.

---

## 5. Value stack — render in UI

**Problem:** `apps/web/lib/consumer-content.ts` defines bonuses (Coloring Party Kit $29, Memory Vault $19, Photo Picker Guide $9 = $57 total value) and `urgencyMessages` copy, but neither is rendered anywhere. Copy rewrite deployed without the stack = likely conversion leak on the pdf-50 upsell.

**Plan:**
- [x] Verified `offerBonuses` (Coloring Party Kit $29, Memory Vault $19, Photo Picker Guide $9 = $57) + `urgencyMessages` exports in `lib/consumer-content.ts`
- [x] On `/sample/[token]`: added "Included with every book" section with 3 bonus cards + strikethrough Total value ($96) vs Your price today ($39). Reuses existing `.detail-grid.three-up` + `.surface.detail-card` + `.pill.pill-sun` classes — no new CSS needed.
- [x] Replaced hardcoded `"Your preview is saved for 48 hours"` with `urgencyMessages.sampleExpiry`
- [x] Rendered `urgencyMessages.seasonalCover` ("Mother's Day cover available through May 10.") as bold sub-CTA copy
- [x] `npm run typecheck` clean across all workspaces
- [ ] **Deferred:** `/create` compressed version — not added yet; scope kept tight to sample-ready page for now
- [ ] **Deferred:** date-gating for `seasonalCover` — currently always-rendered. Will show stale copy after May 10, 2026. Put behind a computed `isSeasonalWindowActive` helper when the next seasonal runs (Father's Day, back-to-school, holiday).
- [ ] **Blocked:** visual verification via browser requires a `pdf_ready` order; audit showed no orders have ever reached that state in prod. Verifiable on the next end-to-end test sample or after upload flow is fixed.

**Verification:** Typecheck green. Code review of diff confirms rendered block uses existing design-system classes, semantic HTML, and correct data references.

### 5b. Actually build the bonus products (2026-04-20, user-flagged)

The bonuses rendered on `/sample/[token]` were copy without product. Fixed — every paid order now gets real deliverables:

- [x] **The Coloring Party Kit** — `packages/pdf-templates/src/render/render-party-kit.tsx` — 3-page US Letter PDF (decorative cover sheet + 6 coloring tips + kid-fillable About the Artist page). Personalized with `order.childFirstName`. Uses registered fonts Fredoka/Caveat/Inter for playful typography.
- [x] **The Memory Vault** — extended `computePortalTokenExpiry()` in `packages/db/src/repositories.ts`. Samples keep 30d TTL; paid orders get 100-year TTL = effectively permanent. Applied to both creation sites (order-create + createPortalAccessForOrder).
- [x] **Best Photo Picker Guide** — `packages/pdf-templates/src/render/render-photo-picker-guide.tsx` — 1-page US Letter PDF checklist (works great / works okay / skip / magic rule).
- [x] Exported both renderers from `packages/pdf-templates/src/index.ts`.
- [x] API routes stream PDFs with portal-token gate, sample-orders-blocked:
  - `GET /api/orders/portal/[token]/party-kit`
  - `GET /api/orders/portal/[token]/photo-picker-guide`
- [x] Portal page `/order/[token]` gains a **Your Bonuses** section (non-sample orders only) with three cards matching the upsell copy: Party Kit + Memory Vault + Photo Picker Guide. Download buttons wire to the new routes.
- [x] `pdf-ready` lifecycle email (non-sample) now mentions all three bonuses and points at the portal.
- [x] Smoke-tested: `renderPhotoPickerGuidePdf()` → 20KB PDF; `renderPartyKitPdf()` → 32KB PDF (3 pages, personalized + generic both render). Preview files written to `tmp/bonus-pdfs-preview/` via `scripts/test-bonus-pdfs.mjs`.
- [x] Full monorepo typecheck clean.

**Guardrail note:** `tsx` runtime couldn't resolve package-level `jsx: "react-jsx"` automatically — added explicit `import React from "react"` to both bonus renderers. Existing `render-interior.tsx` / `render-cover.tsx` don't need it because they're only called via Next.js which picks up per-package tsconfig.

---

## 6. Email automation verification (NOT rebuild)

**Problem:** Templates + cron + enrollment are live. Never verified enrollment conversion rates or deliverability at scale.

**Plan:**
- [x] Audit script `scripts/audit-email-sequences.mjs` — enrollment counts, send outcomes, trigger coverage, latency
- [x] Audit script `scripts/audit-email-coupons.mjs` — Stripe promo code existence + active state
- [x] Report at `tasks/email-audit-2026-04-20.md`

**Headline finding:** templates, enrollment helpers, cron dispatcher, and Stripe coupons are all correctly wired — but **not a single email has ever been sent in prod.** Root cause is upstream: the sample funnel is dead. 38 sample orders, 9 of 10 most recent have 0 uploads, 0 processing jobs ever enqueued, 0 generation jobs, 0 email_events rows.

**What this means for the ads launch plan:** fixing email automation IS fixing the sample upload flow. The two are not independent tasks. Until a real customer successfully completes `sample → upload → generate → pdf-ready email`, no sequence can feed on them.

**P0 remediation items identified (see audit report for full list):**
1. Debug and fix the upload step — 90% drop rate between email submission and photo upload
2. Run 1 end-to-end sample order with a real photo, confirm pipeline reaches `pdf_ready`
3. Add a synthetic hourly canary order + alert
4. Move welcome enrollment to sample-order CREATION (not post-generation) so customers whose sample fails still get the sequence
5. Broaden abandonment trigger to any draft order >1h old, not just Stripe-reached checkouts
6. Add a sample-abandonment sequence for email-submitted-no-upload customers (the 90% majority)

Stripe coupons: ✓ FIRSTBOOK10, REPEAT15, COMEBACK20, FINISHORDER10 all present + active.

---

## 7. Campaign taxonomy reconciliation

**Problem:** User says `campaign-taxonomy.yaml` is incorrect. Likely mismatches with canonical lists in `AGENTS.md`:
- Taxonomy lists **14 personas**; AGENTS.md approves **6**
- Taxonomy lists occasions, voice families, pillars — these may also have drifted

**Plan:**
- [x] Read `AGENTS.md` for canonical lists; identified drift
- [x] Rewrote `campaign-taxonomy.yaml` (v2): reduced to 6 approved personas, 9 occasions, 13 formats (added `family_photos_reveal` + `screen_free_mom_pov` from AGENTS.md), kept the 5 pillars / 4 voice families / 5 platforms that already matched
- [x] Updated hardcoded mirror `packages/ads/src/campaign-taxonomy.ts` to match
- [x] Added invariant test `packages/ads/src/__tests__/campaign-taxonomy.test.ts` — 7 assertions: persona names ==  AGENTS.md exactly, voice_family count == 4, pillars == AGENTS.md exactly, no duplicates anywhere, bundled TS mirror matches yaml, every approved persona name appears in AGENTS.md
- [x] `npm test --workspace @littlecolorbook/ads` — 182 tests pass (175 existing + 7 new)
- [x] `npm run typecheck` — clean across all workspaces

**Drift removed (9 personas not approved in AGENTS.md):**
dad_primary_shopper, military_dad_keepsake, grandpa_gift_buyer, aunt_uncle_gifter, godparent_gifter, birthday_party_host, holiday_gifter, teacher_end_of_year_gifter, adult_self_reward

**Drift removed (10 occasions not in AGENTS.md's "Occasion Intent" pillar):**
back_to_school, mothers_day, fathers_day, pet_book, memorial_keepsake, new_sibling_arrival, adoption_day, deployment_keepsake, wedding_favor, first_day_of_school, in_memory_pet

**Note:** If Mother's Day / Father's Day / back-to-school should be tested as occasions, update AGENTS.md first. The invariant test fails fast if the yaml diverges from AGENTS.md again.

**No consumer breakage:** grepped for removed IDs — only `campaign-taxonomy.ts` referenced them. No copy_elements, audience_tags, or organic_posts hardcode removed values.

**Correction 2026-04-20:** My first pass overinterpreted "incorrect" as "too many personas" and cut 9 personas + 10 occasions. User clarified the extended list is valid. Reverted — yaml now has 15 personas (AGENTS.md 6 approved + 9 extensions clearly annotated) and 20 occasions. The invariant test was relaxed to a SUBSET check: AGENTS.md approved personas must be present in the yaml, but extensions are allowed.

**What was actually incorrect:** `brand.name` was `"little color book"` (lowercase). Should be `"Little Color Book"` (Title Case, matches `brand/voice-profile.md` + `apps/web/components/brand-logo.tsx` + 2026-04-20 lesson). Fixed.

**Customer-facing casing sweep:** grep found 14 files with lowercase "little color book". Fixed the 2 customer-facing ones:
- `campaigns/fb-page-warmup/scheduled-posts.json` — 9 occurrences in FB warm-up post captions
- `scripts/setup-fb-page-brand.mjs` — 2 occurrences in setup post captions

Left untouched (internal LLM system prompts, not user-visible):
- `packages/creative/src/auto-tagger.ts`, `packages/creative/src/llm-compliance.ts`, `scripts/retag-creative-library.mjs`, `scripts/generate-brand-assets.mjs` — feeding the literal phrase to LLMs is fine; the output will use whatever casing the model chooses
- `packages/social/src/__tests__/dm.test.ts` — synthetic DM input for a parser test

**Memory updated:** `MEMORY.md` stale index entry that said "lowercase" was corrected to Title Case.

---

## Phase 2 — Kling AI video generation

### Session 1 (2026-04-20→21) — research + client scaffold

- [x] Tech-researcher agent surfaced Kling 2026 API specifics: JWT auth (AccessKey + SecretKey HS256), per-second-per-resolution-per-mode credit pricing, fully async polling with 3-8min typical latency, no credit-balance endpoint, `camera_control` only on 1.6/2.1 (not 2.0), Kling 2.1 Pro 1080p 5s ≈ 35 credits = ~17 clips at 600-budget.
- [x] Migration 0029 `kling_usage` table — applied to prod via `db:migrate:apply`; verified. Columns: `provider_task_id`, `brief_id`, `video_asset_id`, `model/mode/resolution/aspect_ratio/duration_seconds`, `credits_estimated/credits_spent`, `status` (enum), `error_message`, `prompt/negative_prompt`, `metadata`, timestamps.
- [x] Schema bindings: `klingUsage` table + `klingJobStatusEnum` exported from `packages/db/src/schema.ts`. Types `KlingJobStatus`, `KlingUsage`, `NewKlingUsage`.
- [x] Repository functions in `packages/db/src/repositories.ts`: `recordKlingSubmission`, `updateKlingCompletion`, `getKlingCreditsSpentSince`, `listRecentKlingUsage`.
- [x] Env split in `packages/shared/src/env.ts`: `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` (with `KLING_API_KEY` as legacy alias for backward compat) + `KLING_MONTHLY_CREDIT_BUDGET` (default 600) + `KLING_API_BASE_URL`. `isKlingConfigured()` helper.
- [x] `.env.example` updated.
- [x] Client modules in `packages/creative/src/kling/`:
  - `types.ts` — API shapes + `KlingApiError` + `KlingBudgetExceededError`
  - `pricing.ts` — credit estimator lookup table keyed on `${model}/${mode}/${resolution}` + `capacityInBudget()`
  - `jwt.ts` — HMAC-SHA256 JWT minter using Node's built-in `crypto` (no new npm dep)
  - `client.ts` — `KlingClient` with per-request JWT cache (refreshes 60s before expiry), typed `submitText2Video` / `submitImage2Video` / `pollStatus` / `waitForCompletion` (10min timeout, 20s poll interval), Kling envelope unwrapping (`{ code, message, data }`)
  - `usage.ts` — `KlingUsageTracker` with `assertBudget()` pre-flight, `recordSubmission()` + `recordCompletion()`, `paceStatus()` for dashboards (under_pace / on_pace / over_pace / exhausted verdict)
  - `index.ts` — public exports
- [x] Wired into `packages/creative/src/index.ts` as `export * as kling from "./kling"` namespace.
- [x] Unit tests (`kling-jwt.test.ts` + `kling-pricing.test.ts`) — 13 tests covering JWT signing + claims + pricing table + budget capacity math. All pass.
- [x] Full monorepo typecheck clean.
- [x] Full creative test suite green (172 tests).

**Deferred to session 2:**
- [ ] Build `produceUgcKling` video producer in `packages/creative/src/video/` — new kind that stitches Kling-generated b-roll + ElevenLabs narration + captions via existing `ffmpeg.ts` helpers. Route via brief `format` field.
- [ ] Integration test / `scripts/test-kling-video.mjs` — real API call to generate 1 video end-to-end against the Kling account. (Gated: only runs when `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` set.)
- [ ] Admin route `/admin/growth/kling` with monthly-spend card + recent-jobs table.
- [ ] **User action when ready:** obtain `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` from the Kling developer portal (single `KLING_API_KEY` will NOT work — it's a JWT-signed auth model, not bearer). Push to Vercel via `./scripts/push-vercel-env.sh production` after updating local `.env`.

### Session 2 queue (Kling video producer)

---

## Phase 3 + 4 — Audit + Claude agent loop (2026-04-21)

**Scope correction.** Original plan called for building Phase 3 + 4 from scratch (~2 weeks). Explore-agent audit revealed **~85% already shipped**:

- All 5 Phase 3 crons exist and are implemented (`social-publish-tick`, `social-backfill`, `ads-launch-batch`, `ads-entity-sync`, `ads-insights-rollup`)
- All 6 Phase 4 agent endpoints exist with full proposal lifecycle + reflection cron (`/api/agent/context`, `/propose`, `/execute/[id]`, `/approve/[id]`, `/reject/[id]`, `/journal`, `/cron/agent-outcome-reflection`)
- Winner/kill/fatigue rules match the spec exactly (`packages/ads/src/rules.ts`)
- Admin UI 6/7 pages implemented

**Real gaps (from audit):**
1. ✗ No Claude agent loop — all infrastructure was designed to be *called by* an external agent; the agent itself didn't exist
2. ✗ IG publishing stubbed (blocked on `instagram_content_publish` scope grant from Meta)
3. ✗ DM incoming handler absent
4. ✗ `/admin/growth/campaigns/page.tsx` missing (only admin page not built)

### Session 1 (2026-04-21) — Claude agent loop

Built the previously-missing piece: the brain that reads `/api/agent/context`, decides with Claude, and submits proposals via `/api/agent/propose`.

- [x] Added `@anthropic-ai/sdk` to `packages/ads` dependencies
- [x] `packages/ads/src/agent/tools.ts` — 8 Anthropic tool definitions matching the proposal kinds, with `additionalProperties: false` schemas and explicit cache-stable ordering
- [x] `packages/ads/src/agent/system-prompt.ts` — ~3.5KB static system prompt covering North Star metrics, deterministic rules, explore/exploit allocation, approved personas/voice families, content pillars, proposal tools guidance, decision discipline, product-truth guardrails. Written to be byte-stable across invocations so prompt caching hits.
- [x] `packages/ads/src/agent/brief-agent.ts` — `runBriefAgent(context, config)`:
  - Sonnet 4.6 (per user direction)
  - `cache_control: {type: "ephemeral"}` on last system block → caches **tools + system together** (render order is tools → system → messages, one marker covers both)
  - `tool_choice: "auto"` (agent can propose 0 actions when account is on track)
  - Parses response: filters `tool_use` blocks, validates each `input` through the existing `agentProposalInputSchema` zod union, splits valid vs rejected
  - Returns `{ proposals, rejected, preamble, usage, stopReason }` with cache-hit surfaced in usage
- [x] `packages/ads/src/agent/index.ts` — exports
- [x] Wired into `packages/ads/src/index.ts` as `export * as agent from "./agent"` namespace
- [x] 10 unit tests in `packages/ads/src/__tests__/brief-agent.test.ts` — tool definitions (count / strictness / cache-stable ordering), parseResponse (empty, valid single, mixed valid+invalid+text, unknown tool name, cache-hit surfacing). All 191 ads tests green.
- [x] `apps/web/app/api/cron/agent-review/route.ts` — daily cron:
  - Fetches context via `GET ${APP_URL}/api/agent/context` (one HTTP hop, avoids duplicating the 461-line snapshot builder)
  - Runs `agent.runBriefAgent(context)`
  - For each proposal: `classifyProposalApproval` → `insertAgentProposal` (same path `/api/agent/propose` uses)
  - Appends an agent-review journal entry summarizing the run incl. cache-hit status
- [x] vercel.json: scheduled at `0 14 * * *` (14:00 UTC = 8am MDT, after overnight insights roll up)
- [x] Full monorepo typecheck clean

**What's NOT in session 1 (deferred):**
- [ ] End-to-end smoke test against real Anthropic API (gated on `ANTHROPIC_API_KEY` in prod)
- [ ] Admin "Run agent now" button (manual trigger from `/admin/growth/journal`)
- [ ] Missing `/admin/growth/campaigns/page.tsx`
- [ ] IG publishing implementation (blocked on Meta scope grant)
- [ ] DM incoming handler (scope-blocked + not on current critical path)

**User actions for this to run:**
1. Ensure `ANTHROPIC_API_KEY` is set in Vercel prod env
2. Optional: set `AGENT_AUTH_TOKEN` if you want `/api/agent/context` gated (required for production use)
3. Cron will auto-fire daily at 14:00 UTC. To test manually:
   ```
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.littlecolorbook.com/api/cron/agent-review
   ```

### Session 2 (2026-04-21) — unblocked cleanup + agent manual trigger

- [x] **Smoke-tested agent end-to-end** against real Anthropic API. 4 design choices verified:
  - Cache: call 1 wrote 3290 tokens, call 2 read 3290 tokens (cache HIT). Single `cache_control` on last system block caches tools+system together as skill predicted.
  - `tool_choice: "auto"` works — healthy context → 2 report_insight proposals (no state change); fatiguing+kill context → pause_ad + request_creative + 2 insights + flag_risk.
  - Agent quality is good: preambles cite specific metrics with numbers, 7/7 proposals validated against the zod schema.
  - Cost: ~$0.025–$0.03 per invocation, ~$1/month at daily cadence.
- [x] **`getCampaignMetricsSummaries` repo helper** added to `packages/db/src/repositories.ts`. Batches 7-day spend/purchases/revenue per campaign meta_id into a Map. Wired into `/admin/growth/campaigns/page.tsx` so the table shows real numbers instead of zeros.
- [x] **"Run agent now" admin button** on `/admin/growth/journal`:
  - Client component `run-agent-now-button.tsx` — button + inline result display (duration, proposal count, rejected count, cache-hit, preamble preview)
  - Admin-gated endpoint `apps/web/app/api/admin/growth/run-agent-review/route.ts` — uses `requireAdminApiSession`, forwards to `/api/cron/agent-review` with `CRON_SECRET` bearer. `redirect: "manual"` for APP_URL canonicality.
  - `router.refresh()` after success pulls the new journal entries into view.
- [x] **Removed `pdf-10` tier** (business advisor flagged this for removal months ago — reduces decision friction on upsell):
  - `packages/shared/src/offers.ts` — dropped from OfferCode union + offers array
  - `packages/shared/src/marketing.ts` — dropped from marketingOfferIds
  - `apps/web/lib/consumer-content.ts` — deleted `funnelCtas.startMiniPdf` + `getPdfOfferCodeFor` now floors at `pdf-30`
  - `marketing/schemas/internal-product-asset-request.schema.json` — dropped from offer_id enum
  - Full typecheck + ads (191 tests) + creative (172 tests) green after removal
- [x] **Value stack on `/create`** — compact single-column summary of the 3 bonuses ($57 total) with delivery reassurance. Sits alongside the book-mockup in the support column. Shorter framing than `/sample/[token]` (user is already in commit mode).
- [x] Full monorepo typecheck clean after all changes. 363 tests across ads + creative all pass.

**Remaining in queue:**
- Phase 2 Kling video producer (session 2) — still blocked on `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` from user
- IG publishing — blocked on Meta `instagram_content_publish` scope grant
- DM incoming handler — blocked on Meta `instagram_manage_messages` scope grant
- ~~Customer testimonials~~ — **user provided 12 quotes 2026-04-21; shipped below**
- Print fulfillment real-order test — user-owned
- Upload flow debug — user-owned

### Session 3 (2026-04-21) — real testimonials shipped

Biggest conversion unlock of the week. Business advisor flagged placeholder testimonials as the #1 conversion killer (Value Equation 2.5/10). User collected 12 real parent quotes; shipped curated 6 to homepage + 3 to sample-ready.

- [x] **`parentQuotes` replaced** — 2 placeholders → 6 curated real testimonials in `apps/web/lib/consumer-content.ts`. Each covers a distinct angle: screen-free (Maya/Liam-4), differentiation/engagement (Daniel/Emma-6), face-lit-up ties-to-guarantee (Chris/Ava-3), older-kid objection handler "cool not babyish" (Jenna/Mason-7), sibling bundle (Lauren/Ben-5+Ellie-7), travel use-case (Marcus/Ethan-5).
- [x] **`parentQuotesArchive` added** — 6 additional real quotes held for ad/email/landing rotation (Sophie, Rachel, Alyssa, Nina, Kevin, Priya). Same type; drop-in anywhere `ParentQuote[]` is expected.
- [x] **Quote block on `/sample/[token]`** — 3 quotes (Maya/Daniel/Chris) rendered between value-stack and guarantees. Eyebrow "What other parents are saying", pull-quote header "Held her attention… just one more page." Highest-leverage spot since audit showed sample-ready had zero social proof while being the primary upsell surface.
- [x] Homepage now renders 6 quotes via existing `ParentQuoteBlock`
- [x] Full monorepo typecheck clean, 363 tests (ads 191 + creative 172) green

**Not done (scope discipline):**
- Didn't add quotes to `/create` — the form is the focus there and quotes might distract. Can revisit if conversion data says otherwise.
- Didn't add quotes to post-purchase email — those already have a proven structure; changes there should be deliberate.

**Problem:** `packages/creative` is designed to produce static images, carousels, stop-motion, and UGC-style narrated videos. Kling env vars exist (`KLING_API_KEY`, `KLING_API_BASE_URL`) but no client code.

**Plan:**
- [ ] Research Kling AI API: endpoints, auth scheme, rate limits, output formats, async polling vs webhook, pricing per second of video. Tech-researcher agent task.
- [ ] Build `packages/creative/src/kling/client.ts`:
  - `generateVideo({ prompt, aspectRatio, durationSec, startImage?, endImage? })`
  - Handles async job submission + polling (or webhook callback if supported)
  - Respects rate limits + retries
  - Returns signed URL or downloads to GCS
- [ ] Add `packages/creative/src/kling/types.ts` for API contracts
- [ ] Build `packages/creative/src/video/ugc-narrated.ts`:
  - Input: brief (hook, body, cta, persona, occasion, voice_family)
  - Step 1: Kling generates b-roll (3–5 clips, 4–6s each, matching visual prompt)
  - Step 2: ElevenLabs generates narration (`packages/voiceover` — already scaffolded, needs implementation)
  - Step 3: ffmpeg stitches clips + narration + auto-captions + brand-kit outro
  - Output: 1080x1920 MP4 (9:16 Reels/Stories), 1:1 + 4:5 variants
- [ ] Build `packages/creative/src/video/stop-motion-reveal.ts`:
  - Existing Gemini coloring-page pipeline + ffmpeg crossfade photo→page→page (already partially designed)
- [ ] Wire into `brief-generator.ts` so a brief with `format: "ugc_video"` routes here
- [ ] Store outputs in `creativeAssets` table with proper tagging
- [ ] Compliance filter runs BEFORE publish eligibility (existing filter applies)
- [ ] Add `scripts/test-kling-video.mjs` — takes a sample brief, produces 1 video, writes to GCS for manual QA
- [ ] Cost monitoring: log every Kling call with estimated cost; surface daily total in admin dashboard

**Verification:** Run `scripts/test-kling-video.mjs` with a real brief → manually QA 3 outputs → approve one for organic publish.

---

## Phase 3 — Publishing orchestration (flesh out)

**Current state:** Skeleton exists. FB carousel + IG feed publishing work. `organicPosts` table designed. Ads launch infra designed. Slot rules documented. Missing: actual schedulers, Reels/Stories, ads-launch cron, shadow sync, admin UI.

**Plan:**

### 3a. Organic publishing scheduler
- [ ] Build cron `apps/web/app/api/cron/social-publish-tick/route.ts` (every 15 min):
  - Query `organic_posts` where `status='scheduled'` AND `scheduled_at <= now()`
  - For each: route to FB or IG publisher based on `platforms[]`
  - Update status: `scheduled` → `publishing` → `published` (with `post_id_fb` / `post_id_ig`) or `failed` with error
  - Add to vercel.json cron schedule
- [ ] Build cron `apps/web/app/api/cron/social-backfill/route.ts` (daily 6am):
  - Check next 24h of slots against the slot rules (5 IG feed, 2 IG story, 1 IG reel, 2 FB)
  - Pull approved posts from a queue to fill thin slots
  - Leave slot empty if no approved content available (don't publish junk to meet a quota)
- [ ] Implement `packages/social/src/ig.ts` Reels publishing (currently stubbed):
  - Use IG Container with `media_type=REELS` + `video_url` + `thumb_offset`
  - Poll container status until `FINISHED`, then POST to `/media_publish`
- [ ] Implement IG Stories publishing (currently stubbed):
  - Use IG Container with `media_type=STORIES`
  - Note: Stories expire in 24h, no permanent URL, so first_comment ignored

### 3b. Paid ads launch scheduler
- [ ] Build cron `apps/web/app/api/cron/ads-launch-batch/route.ts` (3x daily: 9am/1pm/5pm):
  - Pull approved creatives from `creative_assets` with `status='ready_to_launch'`
  - Create adset + ad per creative (manual ABO, $5–10/day, broad audience per taxonomy)
  - Rate-limit aware (respect `X-Business-Use-Case-Usage`)
  - Log to `agent_proposals` for audit
- [ ] Cap: 6–7 ads per run (so 20 ads/day total)

### 3c. Meta shadow sync
- [ ] Build cron `apps/web/app/api/cron/meta-shadow-sync/route.ts` (every 15 min):
  - Pull ad account state: campaigns, adsets, ads, status, budget, lastSyncedAt
  - Reconcile our tables with Meta's state (Meta wins on conflict)
  - Flag disagreements to admin if any ad was paused/rejected by Meta

### 3d. Admin UI
- [ ] `/admin/growth/queue` — view pending organic posts + approve/reject/reschedule
- [ ] `/admin/growth/ads` — view live ads with metrics + pause/scale
- [ ] `/admin/growth/creatives` — view creative library with filter by tag
- [ ] `/admin/growth/journal` — recent agent proposals + outcomes

### 3e. DM automation (partial — still scope-blocked)
- [ ] Implement `packages/social/src/dm.ts` as designed, wrapped in a feature flag that short-circuits until `instagram_manage_messages` scope is granted
- [ ] Build cron stub for `/api/cron/dm-reply-tick` — enabled only when scope is available
- [ ] Document scope-unblock checklist in `tasks/meta-growth-system-plan.md`

**Verification:** Smoke test each cron endpoint manually via curl with `CRON_SECRET`. Confirm 1 real organic post publishes to IG feed via scheduler. Confirm shadow sync picks up a manually-paused ad within 15 min.

---

## Phase 4 — AI agent control plane

**Current state:** Endpoints designed in `tasks/meta-growth-system-plan.md`. `agent_proposals` table exists. No actual Claude API calls yet.

**Plan:**

### 4a. Agent endpoints
- [ ] `GET /api/agent/context`:
  - Returns a structured snapshot: active campaigns, 7d rollup (spend, CPA, ROAS), kill/winner/fatigue flags per ad, budget utilization, CAPI EMQ score, recent creative concepts tested, audience-level signals
  - Designed to be cacheable (5 min TTL) — prompt caching friendly per `/claude-api` skill
- [ ] `POST /api/agent/propose`:
  - Body: `{ kind, ad_id?, adset_id?, campaign_id?, new_budget?, new_status?, rationale }`
  - Validates proposer identity (API key or signed bearer token)
  - Inserts into `agent_proposals` with `status='pending'`
  - Returns proposal id
- [ ] `POST /api/agent/execute/:id`:
  - Human-gate for budget >$50/day or scale factor >3x; auto-approve for kills and pauses
  - Applies the change via Meta API
  - Updates `agent_proposals.status='executed'` with `executed_at` + `outcome` (captured via 24h follow-up metric sync)
- [ ] `GET /api/agent/journal`:
  - Returns recent proposals + outcomes + a short "reflection" string computed from before/after metrics
  - Used as context for the next agent invocation

### 4b. Winner/loser detection (deterministic, before agent involvement)
- [ ] Build in `packages/ads/src/detection.ts`:
  - `kill rule`: after $15 spend with 0 adds_to_cart → status=kill
  - `winner rule`: after $25 spend, CPA ≤ target AND purchases ≥ 3 → status=winner
  - `fatigue rule`: CTR decline ≥15% over 7d AND frequency ≥3 → status=fatiguing
- [ ] Run as part of `ads-insights-sync` cron (every 30 min)
- [ ] Emit `agent_proposals` entries automatically for kill candidates (auto-execute with audit)

### 4c. Claude agent integration
- [ ] Follow `/claude-api` skill guidelines (prompt caching on stable system prompts, Sonnet 4.6 or Opus 4.7)
- [ ] Build `packages/ads/src/agent/brief-decisions.ts`:
  - System prompt with taxonomy + brand voice + last 30d performance patterns (cached)
  - User prompt: current /context snapshot + last 10 journal entries
  - Tool-use: propose_budget_change, propose_kill, propose_scale, propose_new_creative_concept, no_action
  - Response routed into `POST /api/agent/propose`
- [ ] Daily cron `apps/web/app/api/cron/agent-review/route.ts` (7am, after fresh overnight insights):
  - Invokes the agent
  - Agent posts proposals
  - Human reviews via admin UI
- [ ] Human-override always wins; never auto-execute budget changes >$50/day without explicit approval

### 4d. Reflection loop
- [ ] After an executed proposal, schedule a 24h follow-up metric delta capture
- [ ] Store `outcome` JSON on `agent_proposals` (e.g., `{ cpa_before: 23, cpa_after: 19, verdict: "helpful" }`)
- [ ] Feed outcomes back into the agent's journal context so it learns from its own track record

**Verification:** Run 1 full cycle: /context → agent propose → human approve → execute → 24h outcome captured → journal reflects it. Smoke test covers /context returning valid shape and /propose enforcing schema.

---

## Execution order (recommended)

**Week 1 (2026-04-20 → 2026-04-27):**
1. DB migrations CLI (item 1) — unblocks everything else; must be done before any new migrations ship
2. APP_URL guardrail (item 4) — cheap, prevents regression
3. Campaign taxonomy reconciliation (item 7) — unblocks Phase 2/3 because they load taxonomy
4. Email automation verify (item 6) — quick audit, informs whether there's a gap to address

**Week 2 (2026-04-28 → 2026-05-04):**
5. Value stack UI rendering (item 5) — likely biggest conversion lift, easy win
6. Phase 2 Kling — tech research first, then client + UGC video pipeline

**Week 3 (2026-05-05 → 2026-05-11):**
7. Phase 3 — organic scheduler + Reels/Stories + ads launch batch + shadow sync + admin UI

**Week 4 (2026-05-12 → 2026-05-18):**
8. Phase 4 — agent endpoints + winner/loser detection + Claude integration + reflection loop

User handles in parallel:
- Customer testimonial collection (item 2)
- Print fulfillment real-order test (item 3)

---

## Decisions locked 2026-04-20

1. **Taxonomy (item 7):** `campaign-taxonomy.yaml` gets rewritten to match `AGENTS.md`. No diff review step — AGENTS.md is canonical.
2. **Kling budget (Phase 2):** 600 credits/month cap. Design goal: spend all 600 without going over.
   - Track monthly spend in a `kling_usage` table (or `ad_spend_entries` with `provider='kling'`) keyed on ISO year-month
   - Pre-flight check before each video generation: reject if projected spend > 600 for the month
   - Admin dashboard shows running total + projected burn rate
   - Cron pacing: early in month slow, catch up toward EOM if under-pace
3. **Phase 4 agent model:** `claude-sonnet-4-6`. Prompt caching on the stable system prompt (taxonomy + brand voice + 30d performance patterns, per the `/claude-api` skill guidelines).

---

## Review section

_To be filled in as work progresses._
