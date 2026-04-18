# Meta Growth System — Implementation Plan

**Last updated:** 2026-04-17
**Status:** Draft — awaiting Alec's approval to move to execution
**Owner:** AI-assisted build
**Budget envelope target (launch):** $50–200/day total paid spend, scaling to $500+/day at day 60

---

## 0. Intent (one paragraph)

Build a closed-loop Meta growth system inside the `littlecoloringbook` monorepo that (a) generates 20 paid ad creatives/day and 10 organic posts/day across Facebook + Instagram using our existing Gemini pipeline + Canva + Kling + ElevenLabs, (b) publishes, measures, and rotates creative via the Meta Marketing + Instagram Graph APIs, (c) closes the conversion loop with a first-class Pixel + Conversions API integration, (d) handles inbound DMs on both platforms, and (e) exposes a clean data+action contract so Claude/Codex agents (run from Claude Desktop routines or cron) can read performance and propose/apply budget, targeting, and creative decisions. The system must be resilient to Meta's AI-driven enforcement and hit EMQ ≥ 7 before we scale spend.

---

## 1. Guiding design principles

1. **Don't reinvent what's already there.** The repo already has BullMQ queues, cron route pattern with `authorizeInternalJobRequest`, Drizzle schema with `adSpendEntries` + `metricsDailyRow` shapes, a mature `campaign-taxonomy.yaml`, and Neon-Auth-protected admin UI. The Meta system plugs into *these*, not a parallel stack.
2. **One-way door decisions get architecture review. Two-way doors ship.** Schema changes, token scopes, CAPI event names, and ad account structure are one-way. Creative prompt templates and hourly routines are two-way.
3. **Slow, boring signal beats fast, noisy action.** Meta's learning phase needs ~50 conversions/adset/week. 20 creatives/day at $5–10 each is our *discovery* layer, not our *scaling* layer. Winners graduate into CBO/ASC only after validated.
4. **The AI agent loop is a tool, not the driver.** Design the data + action layer first; agents call it. Never let an agent mutate the ad account without a human approval gate above ~$50/day budget change or >3× duplication.
5. **Assume the account can be flagged at any time.** Every mutation is logged, reversible, and rate-limited. We maintain a shadow state so we can compare "what we asked Meta to do" vs "what Meta says is running."
6. **Compliance is a feature, not a checklist.** Ban-risk mitigations (ramp curves, page warm-up, landing page scan, EMQ gate) are encoded in the system, not left to operators.

---

## 2. Phased delivery

Build in 5 phases. Each phase ships end-to-end and is individually useful. Target ~1 week/phase with focused effort.

### Phase 0 — Foundations (Week 0, pre-build)
Prerequisites before any code. Most are manual in Meta Business Manager.

- Business Manager business verification complete; domain verified; ad account aged ≥30 days before scaling past $50/day.
- Dedicated System User created in Business Manager; token scopes: `ads_management`, `ads_read`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `pages_messaging`, `instagram_content_publish`, `instagram_manage_messages`, `instagram_manage_insights`, `instagram_basic`, `business_management`, `private_computation_access`, `catalog_management`.
- System User assigned as Admin on: Ad Account, Page, Instagram Account, Pixel/Dataset, Product Catalog.
- Apply for Advanced Access → "Ads Management Standard Access" (unlocks 100K+ calls/hour tier). Required App Review.
- Apply for Advanced Access → `instagram_content_publish` (required to publish to non-owned accounts; for own IG it's already Standard).
- Facebook Page seeded with ≥2 weeks of organic content (10 posts minimum) before first paid ad. Can begin this immediately in parallel with build.
- Landing page policy scrub — no "know your child" personal-attribute language, no unsubstantiated claims, no false urgency timers. Use Meta's Ad Preview crawler before launching.
- Install Meta Pixel on littlecolorbook.com with at least 5 events: `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`. Add `Lead` for sample form submits.
- Register all Meta env vars in `packages/shared/src/env.ts` and `.env.example` (see §10).

### Phase 1 — Meta API client + CAPI (Week 1)

**Goal:** We can programmatically read the ad account, post a test ad, and send server-side conversion events that deduplicate with the browser pixel. Nothing runs on a schedule yet.

Deliverables:
- New package `packages/meta` — thin typed wrapper around the Graph API for: auth/token rotation, ads (campaign/adset/ad CRUD), creatives (image + video upload), insights (async job pattern), audiences, pages, Instagram media containers + publish, Messenger/IG DM send + receive, CAPI event post. Uses `facebook-nodejs-business-sdk` v24+ where it helps, raw fetch where the SDK lags.
- Rate-limit aware client: respects `X-Business-Use-Case-Usage` and `X-Ad-Account-Usage` headers, auto-backoff on err 613 and 17, per-operation BUC bucket tracking.
- CAPI pipeline:
  - Server-side event dispatcher in `packages/meta/capi` with hashed PII normalization (SHA-256 lowercase-trim for `em`/`ph`/`fn`/`ln`/`db`/`ge`/`ct`/`st`/`zp`/`country`), raw `fbp`/`fbc`/`client_ip_address`/`client_user_agent`.
  - Browser helper (`apps/web/lib/pixel.ts`) that generates a UUID `event_id` per event, fires pixel, and enqueues a matching CAPI event to a new BullMQ queue `capi-events`.
  - Worker processor `process-capi-event` that POSTs to the dataset events endpoint with deduplication.
  - Hook every existing conversion point: sample request (→ `Lead`), checkout open (→ `InitiateCheckout`), Stripe `checkout.session.completed` webhook (→ `Purchase` with value + currency + content_ids), add-to-cart, product view.
- EMQ dashboard in admin UI showing live EMQ per event type (scraped from Events Manager via Graph API `match_quality` field if available, else manual paste for now).
- **Gate:** Do not advance to Phase 2 until EMQ ≥ 7 on `Purchase` and `Lead` in a sustained 48-hour test window.

### Phase 2 — Creative production pipeline (Week 2)

**Goal:** A single API call produces a finished, Meta-spec-compliant creative asset (image or video, all aspect ratios) from a brief.

Deliverables:
- New package `packages/creative` — orchestrates creative production. Exposes `produceCreative(brief) → { assets, metadata }` where `assets` has all required aspect ratios (1:1, 4:5, 9:16, 16:9 per asset type).
- Creative types supported on day 1:
  - **Static image** — Gemini pipeline (reuse `renderImageWithGemini`) for hero illustration, then Canva Connect autofill to drop into branded template with copy. Export PNG in 4 aspect ratios.
  - **Carousel image** — N frames generated as a sequence via Gemini + Canva template, packaged as N distinct image URLs for IG carousel container.
  - **Stop-motion reveal video** — Gemini pipeline generates source photo + coloring page version; ffmpeg assembles crossfade/reveal sequence. ~5–10s. Our highest-conviction format.
  - **UGC-style narrated video** — Kling 3.0 (text-to-video) or Luma Ray3.14 for b-roll, ElevenLabs voice clone narration, captions burned in via ffmpeg.
- Creative asset library (`creativeAssets` table, §8): tags each asset with `concept`, `format`, `persona`, `occasion`, `offer`, `hook`, `cta`, `variant_axis` (hook/body/cta/visual/format). Tag taxonomy maps exactly to `campaign-taxonomy.yaml`.
- Asset sourcing:
  - Seed library from the 1,300 existing pipeline test images — script `scripts/seed-creative-library.ts` ingests, tags heuristically (filename + metadata), uploads into `creativeAssets`.
  - Customer-consented samples (Phase 3.5): opt-in checkbox on sample form ("let us use your creation in our examples"), consent stored, surfaced only for consented samples. Illustrated output only; never raw child photos.
- **Compliance filter:** Before any asset is eligible for publish, run through a lightweight policy scanner (regex + LLM check) for banned phrases and personal-attribute language. Fail closed.
- Brief DSL: a small typed brief object `{ concept, format, hook, body, cta, persona, occasion, offer, visual_prompt, voice_family? }` — enough to reproduce any creative deterministically.

### Phase 3 — Publishing + campaign orchestration (Week 3)

**Goal:** Scheduled jobs post 10×/day organic and create 20 ads/day, each in the right campaign structure.

Deliverables:
- **Organic publishing loop:**
  - `organic_posts` table: status state machine (draft → scheduled → publishing → published/failed), target platforms (FB, IG, both), media refs, caption, first-comment, scheduled_at, post_id_fb, post_id_ig.
  - `packages/social` — FB Page post create, IG container + publish workflow (single, carousel, Reel, Story), retry on rate-limit.
  - Cron `apps/web/app/api/cron/social-publish-tick/route.ts` — every 15 min, pulls due `organic_posts`, publishes.
  - Cron `apps/web/app/api/cron/social-backfill/route.ts` — daily at 6am, looks ahead 48h, auto-fills any thin slots from the approved creative queue using slot rules (see below).
  - Slot rules (editorial logic):
    - 10 slots/day: 5 IG feed, 2 IG story, 1 IG reel, 2 FB feed. Tuned later.
    - Each slot has preferred (format, persona, occasion) tags.
    - Human override always wins: admin UI can pin or pre-schedule specific posts.
- **Paid campaign orchestration:**
  - `ad_campaigns`, `ad_sets`, `ads` tables mirroring Meta's hierarchy, with `meta_id`, `status`, `budget_cents`, `objective`, `optimization_goal`, creative ref, last_synced_at.
  - Launch structure **manual ABO for first 60–90 days**:
    - 1 "discovery" campaign with objective `OUTCOME_SALES` (or `OUTCOME_LEADS` for sample funnel).
    - Daily rolling batch of 20 new ads, each in its own fresh ad set at $5–10/day, each targeting a single concept + broadest defensible audience (US, ages 25–55, optionally broad interest bundle).
    - No overlap guarantee: each ad is a distinct `adcreative_id` referencing a distinct creative (no "change-one-word" variants — real diversity).
    - Use `object_story_id` reuse only AFTER an ad has crossed a social-proof threshold (50+ reactions or 20+ comments). Pre-that, each ad = new post.
  - Cron `apps/web/app/api/cron/ads-launch-batch/route.ts` — runs 3× daily (9am/1pm/5pm), each emitting 6–7 ads so launches are spread not bursted. Respects per-day cap enforced in DB.
  - Creative → ad mapping rules pulled from `campaign-taxonomy.yaml` — its `formats`, `personas`, `occasions`, and KPI targets drive the generator's sampling distribution.
- **Shadow sync:** every 15 min, pull Meta's authoritative state for campaigns/adsets/ads/status/budget into our tables. We never trust our local state for decisions.

### Phase 4 — Performance, optimization loop, AI agent control plane (Week 4)

**Goal:** A Claude/Codex agent can read system state and propose changes; approved changes execute; metrics flow into admin dashboard.

Deliverables:
- **Metrics ingestion:**
  - Cron `apps/web/app/api/cron/ads-insights-sync/route.ts` — every 30 min pulls ad-level insights (last 7d sliding window) via async Graph job, writes to `ads_metrics_daily` (ad_id, date, impressions, reach, frequency, spend, clicks, ctr, cpm, link_clicks, landing_views, adds_to_cart, initiate_checkouts, purchases, revenue, cpa, roas, video_p25/p50/p75/p100, hook_rate).
  - Separate adset-level and campaign-level rollups materialized daily.
  - `adSpendEntries` (already exists) gets populated from Meta metrics nightly for the cross-platform spend picture.
- **Winner/loser detector (encoded, deterministic — not the agent's job):**
  - Per-ad: kill rules from taxonomy (`kill_rules`). E.g., after $15 spend with 0 adds_to_cart, pause.
  - Per-ad winner flag: after $25 spend, CPA ≤ target AND purchases ≥ 3 → `status=winner`.
  - Per-ad fatigue flag: CTR decline ≥15% over 7d AND frequency ≥3 → `status=fatiguing`.
  - Winner auto-actions (optional, gated): duplicate into a "scaling" CBO campaign at 2× budget.
- **AI agent control plane** — this is the meta-cool part:
  - Expose an internal HTTP API under `apps/web/app/api/agent/*` (protected by `INTERNAL_JOB_SECRET`):
    - `GET /agent/context` — snapshot: active campaigns, 7d rollup, kill/winner/fatigue flags, budget utilization, CAPI EMQ, recent creative concepts tested.
    - `POST /agent/propose` — agent submits structured proposals: `[{ kind: "scale_budget", ad_id, new_budget, rationale }, …]`. Proposals go to `agent_proposals` table as `status=pending`.
    - `POST /agent/execute/:id` — executes a proposal (admin-only for >$50/day budget changes or >3× scale; auto-approves for kills and small tests).
    - `GET /agent/journal` — recent decisions and their outcomes, for reflection loop.
  - An optional MCP server (stretch) that wraps the above HTTP endpoints so Claude Desktop can call them directly as tools.
  - Claude Desktop routine (manual for now, schedulable via the `schedule` skill): daily 7am "market review" prompt that hits `/agent/context`, analyzes, posts proposals; human reviews; 9am a "execute approved" prompt runs.
- **Admin dashboard additions** (`apps/web/app/admin/growth/*`):
  - `/admin/growth` — top-line: today's spend, CPA, ROAS, AOV, funnel conversion, active creative count, fatigue count, EMQ gauge, ban-risk indicator (spend ramp vs day-of-account-life heuristic).
  - `/admin/growth/creative` — creative library, filter by tag, performance-ranked, concept win-rate.
  - `/admin/growth/ads` — ad-level table with sort/filter, inline pause/scale.
  - `/admin/growth/organic` — upcoming 7-day publish calendar, slot fill rate, top-performing posts.
  - `/admin/growth/inbox` — DM inbox (Phase 5).
  - `/admin/growth/agents` — proposals pending review, journal, approve/reject.

### Phase 5 — Inbox (DMs) (Week 5)

**Goal:** Inbound DMs on IG and FB Messenger are triaged, auto-replied where safe, and escalated to a human inbox when not.

**Context:** Message tags `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, `POST_PURCHASE_UPDATE` are deprecated April 27, 2026 (days away). We build around the 24-hour window and `HUMAN_AGENT` tag only. No re-engagement outside the window via Messenger — email handles that.

Deliverables:
- Webhook `apps/web/app/api/webhooks/meta/route.ts` — handles FB Messenger + IG Direct events (messages, message_echoes, postbacks, reactions). Verifies `X-Hub-Signature-256`.
- `dm_threads`, `dm_messages` tables — thread is (page_or_ig, user_psid), messages are in/out with `meta_message_id`, body, attachments, sent_at.
- Auto-reply rules engine: keyword → canned response + resource link. Fall through to "we'll be right with you" + human handover if uncertain.
- Integration with existing `tickets` table: if a DM escalates, a ticket is opened, agent handover tag is set on Meta side, human takes over in admin inbox UI.
- Admin inbox UI with reply form, 24-hour window timer, quick canned responses.
- Optional: LLM-powered FAQ auto-answer using our existing FAQ content + brand voice profile, with a confidence threshold gate.

### Phase 6 (stretch) — Advantage+, product catalog dynamic ads, lookalike seeding

- Once we have 50+ weekly purchases: graduate top-performing creative into Advantage+ Sales Campaigns for automated scaling.
- Build product catalog (Commerce Manager) with our SKU variants; launch Advantage+ catalog ads using completed-book mockups.
- Value-based lookalikes from our Stripe purchase history.

---

## 3. Data model additions (Drizzle)

All new tables follow repo conventions: text PKs, `createdAt`/`updatedAt` with timezone, indexed FKs, pgEnums for status columns. Migration `0012_meta_growth.sql` onwards.

Core new tables:
- `metaTokens` — token id, label, scopes, issued_at, rotated_at, encrypted_token, notes. Supports rotation.
- `metaAdAccounts`, `metaPages`, `metaInstagramAccounts`, `metaPixels` — the asset graph, one-row-per-asset config.
- `adCampaigns`, `adSets`, `ads` — local mirror of Meta hierarchy with `metaId`, `status`, sync timestamps.
- `adCreatives` — local record of `adcreative_id` and the brief that produced it.
- `creativeAssets` — physical asset library: kind, gcs paths (per aspect ratio), tags, source (`gemini`/`canva`/`kling`/`eleven_labs`/`customer_sample`), consent status, compliance scan result, created_at.
- `creativeBriefs` — the brief record; assets reference their brief.
- `adsMetricsDaily`, `adSetMetricsDaily`, `campaignMetricsDaily` — time-series; (entity_id, date) unique.
- `organicPosts`, `organicPostMetrics` — scheduling + engagement time-series.
- `dmThreads`, `dmMessages` — inbox.
- `capiEvents` — event_id, event_name, user_data hash fingerprints, payload, status (`queued`/`sent`/`failed`), meta_events_received trace id.
- `agentProposals` — id, kind, payload, rationale, status (`pending`/`approved`/`rejected`/`executed`/`failed`), created_by, reviewed_by, outcome notes.
- `agentJournal` — append-only log of agent actions and their observed outcomes (for reflection).
- `metaWebhookEvents` — raw event log mirror of Stripe's pattern.
- `metaApiCalls` (optional but valuable) — append-only audit of every mutation: who, when, endpoint, payload hash, response, BUC usage. Cheap insurance when debugging bans.

Enum suffixes follow `*Values` + `*Enum` convention. Status columns default to draft/pending.

---

## 4. Monorepo package additions

| Package | Purpose | Depends on |
|---|---|---|
| `packages/meta` | Typed Graph API client, token mgmt, rate limiter, CAPI dispatcher | `shared` |
| `packages/creative` | Brief → assets orchestration (Gemini + Canva + Kling + ElevenLabs) | `pipeline`, `shared`, `meta` (for spec constants) |
| `packages/social` | Organic publishing (FB + IG) and inbox helpers | `meta`, `db` |
| `packages/ads` | Campaign structure templates, launch logic, optimization rules engine | `meta`, `db` |

New worker jobs in `packages/jobs`:
- `process-capi-event`
- `produce-creative` (runs the brief → assets pipeline)
- `publish-organic-post`
- `launch-ad-batch`
- `sync-meta-insights`
- `sync-meta-entity-state` (mirrors campaigns/adsets/ads)
- `process-inbound-dm`
- `execute-agent-proposal`

New cron routes under `apps/web/app/api/cron/`:
- `social-publish-tick` — every 15 min
- `social-backfill` — daily 6am
- `ads-launch-batch` — 3× daily (9am/1pm/5pm)
- `ads-insights-sync` — every 30 min
- `ads-entity-sync` — every 15 min
- `creative-daily-batch` — daily 3am, produces next day's creative inventory
- `capi-reconcile` — hourly, retries failed CAPI events and logs EMQ drift

---

## 5. AI agent control plane — detail

Why a control plane instead of letting the agent have the Meta token directly:
- Meta account bans are irreversible-ish; we want every mutation attributable, reviewable, and rate-limited by our logic, not by the agent's prompt discipline.
- Multiple agent backends (Claude, Codex, local) can plug in with no Meta auth knowledge.
- The "journal + proposal + outcome" structure is how the agent learns over time.

Agent contract:
- **Read** from `/agent/context` — a carefully shaped JSON snapshot, not a raw Meta dump. Includes only what an analyst needs: aggregated metrics, flagged ads, budget headroom, last 7 days of actions and outcomes, current creative concept inventory.
- **Propose** via `/agent/propose` with discrete typed actions. Proposal kinds v1: `pause_ad`, `scale_budget`, `duplicate_to_scaling_campaign`, `request_creative` (brief), `update_targeting`, `update_audience`, `report_insight` (write to journal), `flag_risk`.
- **Execute** via `/agent/execute/:id`. Approval matrix:
  - `pause_ad`, `request_creative`, `report_insight`, `flag_risk` → auto-approved.
  - `scale_budget` ≤ 2× and ≤ $30/day absolute → auto-approved.
  - Anything else → human approval in admin UI.
- **Reflect**: every executed proposal gets an outcome appended 24h and 72h later (from metrics), visible in `/agent/journal`. The agent sees its own track record next time.

Claude Desktop routine setup (using the `schedule` skill): two triggers/day. 7am market-review that reads context and posts proposals. 9am approved-execution check-in that asks for confirmation on pending items. MCP server (optional stretch) registers the above as tools so the agent calls them natively.

---

## 6. Creative system — detail

Creative diversity is our moat. Real diversity, not lorem-ipsum variation.

**Variant axes** (each creative tagged on all 5):
- Hook (emotional payoff in first 2 seconds): transformation reveal / recognition surprise / gift moment / parenting pain point / screen-free validation
- Body (core claim): personalization / keepsake / screen-free / easy / quick turnaround
- CTA: "Make your sample" / "Try one free" / "See what your photo looks like" / "Order their book"
- Visual style: stop-motion / UGC POV / flat illustration / carousel of finished pages / before-after reveal / mom talking-head (ElevenLabs + Luma b-roll)
- Format: 9:16 video / 1:1 image / 4:5 image / carousel / Reel

**Daily brief generator** samples a matrix from `campaign-taxonomy.yaml`:
- Priors weighted by historical concept win-rate.
- Enforce minimum diversity per day: no more than 3 ads share all 5 axes.
- Always include 2–3 "explore" slots with deliberately different combinations.

**Creative library seeding:**
- Script `scripts/seed-creative-library.ts` (run once): ingest the 1,300 test images, run Gemini `describeForTags` over each to auto-tag by (content, style, demographic, mood), dump into `creativeAssets` with `source=pipeline_test_batch`, status=`review`. Human batch-approves in admin UI.
- Customer-consented samples: consent UX on sample form; only stylized coloring page output is ever promoted; raw child photos never leave the system.

**Compliance scanner** (pre-publish gate):
- Regex pass: banned phrases from Meta policy corpus (we maintain as `packages/shared/policy.ts`).
- LLM pass: Claude Haiku evaluates headline+body+image alt text against a compact policy prompt, outputs pass/soft-flag/hard-flag + reason.
- Hard-flag → block publish, log to `complianceRejections`, notify ops.
- Soft-flag → publish with tag, track performance vs. baseline (is Meta penalizing it?).

---

## 7. Compliance + ban-risk mitigations (encoded)

Built into the scheduler, not the operator's memory:
- **Spend ramp curve:** max daily spend = `min(hard_cap, f(account_age_days))`. E.g., days 0–14 ≤ $50/day, 15–30 ≤ $150/day, 30–60 ≤ $500/day, 60+ open. Enforced at `ads-launch-batch` time.
- **Launch spread:** never >8 new ads in a 60-min window. 3× daily cron aligns with this.
- **Per-creative minimum budget:** $5/day. Prevents creating dozens of under-serving ads.
- **Page warm-up guard:** block first paid ad launch if page has <10 organic posts and <14 days of history.
- **Landing page scanner:** weekly cron fetches littlecolorbook.com and key funnel URLs, runs the same compliance scanner as creative. Alerts on new violations.
- **EMQ floor:** daily alert if any event's EMQ drops below 6.5. Automatic spend throttle if < 5.5 sustained 48h.
- **Spend velocity alarm:** if daily spend exceeds 7-day-avg × 1.8, pause launches pending review.
- **Proposal rate limit:** agent proposals capped at 50/day; repeated identical proposals within 24h rejected.

---

## 8. Open questions / decisions needed from Alec

1. **Brand naming:** `campaign-taxonomy.yaml` uses "Crayon Keepsake"; repo uses "littlecolorbook.com". Which is the brand for ad copy + page name?
2. **Page + IG account status:** Are the FB Page and IG Business account already set up, verified, and linked? Is business verification complete?
3. **Ad account age:** What's the current age of the ad account we'll use?
4. **Initial daily budget cap:** Confirm $50/day start is right (or different), and the ramp curve.
5. **Human review bandwidth:** Who approves agent proposals? What SLA (minutes/hours)?
6. **Customer sample consent:** OK to add opt-in to the sample form to use their created coloring pages (not raw photos) in our social/ads?
7. **Video generation provider priority:** I'd default to Kling 3.0 (cheapest, no approval gate, 1080p). Want me to add Luma Ray3 as fallback only?
8. **Which AI agent will be primary driver** for the daily routine — Claude Desktop with MCP, or a separate cron-run Codex agent hitting the HTTP API? (Both supported; one will ship first.)
9. **ASC graduation threshold:** I suggest 50 purchases/week before we layer in Advantage+. Agree?
10. **DM auto-reply tolerance:** How aggressive? Never / keyword-only / LLM with confidence gate?

---

## 9. Phase 0 launch checklist (blocking items before Phase 1 code starts)

- [ ] Meta Business Manager verification complete
- [ ] Dedicated System User + token (with all scopes above)
- [ ] Ad account, Page, IG account, Pixel/Dataset, Catalog all assigned to the System User
- [ ] Apply for Advanced Access on `ads_management` standard + `instagram_content_publish`
- [ ] Meta Pixel installed and firing all 5 events
- [ ] Facebook Page seeded with ≥10 organic posts over ≥14 days
- [ ] Landing page compliance scrub done
- [ ] `.env` populated with Meta env vars (see §10)
- [ ] Answers to §8 open questions

---

## 10. Environment variables to add

```
# Meta / Facebook
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_USER_TOKEN=
META_BUSINESS_ID=
META_AD_ACCOUNT_ID=
META_PAGE_ID=
META_IG_USER_ID=
META_PIXEL_ID=
META_DATASET_ID=                     # same as pixel_id for most cases
META_CATALOG_ID=                     # optional phase 6
META_GRAPH_API_VERSION=v22.0         # or v23.0 if released
META_WEBHOOK_VERIFY_TOKEN=
META_WEBHOOK_APP_SECRET=             # for x-hub-signature-256 verification
META_TEST_EVENT_CODE=                # for CAPI test mode

# Creative providers (most already exist per env.ts)
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_ACCESS_TOKEN=                  # if using long-lived
KLING_API_KEY=
KLING_API_BASE_URL=
LUMA_API_KEY=
# ELEVENLABS_API_KEY                 (exists)
# GAMMA_API_KEY                      (exists, will probably not use)

# Agent control plane
AGENT_API_KEY=                       # separate from INTERNAL_JOB_SECRET for auditability
AGENT_APPROVAL_WEBHOOK=              # optional Slack/email alert for pending proposals
```

---

## 11. Risk register (top 5)

1. **Meta ad account restriction** mid-build. *Mitigation:* all mitigations in §7 + encoded ramp curve + landing page scanner.
2. **Creative diversity collapses into AI-slop sameness** that Meta flags as ad-farm. *Mitigation:* 5-axis diversity tagging, enforced minimum diversity per day, human review gate on new concept families.
3. **CAPI deduplication drift** corrupts optimization signal. *Mitigation:* daily reconcile cron + EMQ floor alarms + integration tests that validate event_id roundtrip.
4. **Agent proposes a bad scale action that burns $500 before we notice.** *Mitigation:* approval matrix in §5, spend velocity alarm, proposal rate limit, auto-rollback on CPA regression > 50% within 6h.
5. **IG/Messenger deprecation (April 27, 2026)** leaves us without re-engagement channel we planned. *Mitigation:* design assumes 24h window only + HUMAN_AGENT tag; re-engagement handled by existing Resend email flows.

---

## 12. What this plan is explicitly NOT doing (yet)

- TikTok/Reddit/Pinterest publishing — taxonomy supports them but out of scope for v1.
- Google Ads — separate initiative.
- Creator partnerships (UGC creator contracts, whitelisting) — future phase.
- Multi-language — US English only for v1.
- Influencer outreach automation — separate.
- Full A/B testing framework with holdout groups — v1 uses ABO creative-level attribution which is pragmatic; real lift studies come later.
