# Marketing Adapter Endpoints

## Purpose

This document defines the proposed internal endpoint surface for the OpenClaw marketing operator.

It is aligned to the current repo primitives:

- `OfferCode` from `packages/shared/src/offers.ts`
- `DeliveryMode` from `packages/shared/src/order.ts`
- `cleanupSteps` and `qaChecklist` from `packages/pipeline/src/index.ts`
- worker jobs from `apps/worker/src/index.ts`

These are internal endpoints. They should be protected with the same internal auth model used for async jobs.

## Naming Rules

- Use `/api/internal/marketing/*` for synchronous orchestration endpoints
- Use worker jobs for heavy rendering or generation work
- Make every endpoint idempotent when possible
- Return stable `request_id` and `asset_id` values

## Shared Enums

### offer_id

Allowed values for v1:

- `sample-free`
- `pdf-10`
- `pdf-30`
- `pdf-50`
- `pdf-100`
- `print-30`
- `print-50`
- `print-100`

### delivery_mode

Allowed values:

- `pdf`
- `print`

### order_style

Allowed values:

- `sample`
- `pdf_preview`
- `print_mockup`
- `bundle_mockup`
- `proof_pair`
- `book_preview`
- `cover_variant`
- `proof_video`

## 1. Render Single Sample Page

`POST /api/internal/marketing/render-sample-page`

### Purpose

Generate a single product-proof sample page from one approved source asset.

### Request schema

Use `schemas/internal-product-asset-request.schema.json` with:

- `order_style = sample`
- one `source_asset_ids` item

### Response schema

Use `schemas/internal-product-asset-response.schema.json`

### Notes

- should default to preview-safe output sizes
- should return both preview and social-ready variants when requested
- can be fulfilled synchronously for lightweight jobs or return queued status if needed

## 2. Render Before and After Proof Pair

`POST /api/internal/marketing/render-proof-pair`

### Purpose

Generate a side-by-side or sequential proof asset showing original photo and converted coloring page.

### Request specifics

- `order_style = proof_pair`
- one `source_asset_ids` item
- output formats can include image or short-form video snippets

## 3. Render Book Preview

`POST /api/internal/marketing/render-book-preview`

### Purpose

Generate a multi-page preview sequence for a chosen offer.

### Request specifics

- `order_style = book_preview`
- multiple `source_asset_ids` allowed
- must include `offer_id` and `page_count_offer`
- may include `child_first_name`

### Output expectations

- preview pages
- optionally a short page-flip preview clip
- metadata on selected render profile

## 4. Render Print Mockup

`POST /api/internal/marketing/render-print-mockup`

### Purpose

Create print-ready mockups for the merchandised print offers.

### Request specifics

- `order_style = print_mockup`
- `offer_id` should be one of `print-30`, `print-50`, `print-100`
- `bundle_offer` should be one of `solo`, `sibling_set`, `sibling_trio`

### Required outputs

- front cover mockup
- stack or spread mockup
- optional hand-held or table-top scene mockup

## 5. Render Cover Variant

`POST /api/internal/marketing/render-cover-variant`

### Purpose

Generate child-name or sibling-name cover variants from a base cover style.

### Request specifics

- `order_style = cover_variant`
- `child_first_name` required
- may include `bundle_offer`

## 6. Render Proof Video

`POST /api/internal/marketing/render-proof-video`

### Purpose

Generate short product-proof video clips suitable for TikTok, Reels, and paid ads.

### Request specifics

- `order_style = proof_video`
- source visuals come from approved sample pages, proof pairs, or preview pages
- output ratios should support `9:16`, `1:1`, and `4:5`

### Required outputs

- `video/mp4` export
- thumbnail
- subtitle-safe zones in metadata

## 7. Batch Creative Wrapper Request

`POST /api/internal/marketing/arcads/batch-create`

### Purpose

Queue a batch of Arcads variants around one approved script family.

### Request body

- `script_family_id`
- `variants[]`
- `cutaway_asset_ids[]`
- `offer_id`
- `occasion`
- `platform`

### Response

- `batch_id`
- `queued_variants`
- `provider = arcads`

## 8. Voice Render Request

`POST /api/internal/marketing/voices/render`

### Purpose

Render or dub voice assets through ElevenLabs.

### Request body

- `script_text`
- `voice_id`
- `voice_family`
- `language`
- `speed`
- `emotion_style`

### Response

- `audio_asset_id`
- `audio_url`
- `duration_ms`
- `provider = elevenlabs`

## 9. Daily Metrics Ingest

`POST /api/internal/marketing/metrics/daily-ingest`

### Purpose

Accept normalized performance rows from platform connectors or a warehouse sync.

### Request body

- `report_date`
- `rows[]`

Each row must match `schemas/metrics-daily-row.schema.json`

### Response

- `ingest_id`
- `rows_received`
- `rows_accepted`
- `rows_rejected`
- `errors[]`

## 10. Experiment Ranking

`POST /api/internal/marketing/experiments/rank`

### Purpose

Compute winner, loser, fatigue, and next-action recommendations from the latest registry and metrics.

### Request body

- `report_date`
- `mode` as `early_account` or `mature_account`
- optional baseline overrides

### Response schema

Use `schemas/experiment-decision.schema.json` as the per-asset recommendation shape.

## 11. Organic Queue Write

`POST /api/internal/marketing/queues/organic`

### Purpose

Write today’s approved organic publishing queue.

### Request body

- `date`
- `assets[]`
- `publish_windows[]`

### Side effects

- writes `marketing/queues/today-organic-queue.json`
- should remain auditable and append-only in logs

## 12. Paid Nomination Write

`POST /api/internal/marketing/queues/paid`

### Purpose

Write the short list of creative assets approved for paid testing.

### Request body

- `date`
- `assets[]`
- `notes`

### Side effects

- writes `marketing/queues/today-paid-nominations.json`

## 13. Weekly Synthesis Export

`POST /api/internal/marketing/reports/weekly-synthesis`

### Purpose

Generate the weekly synthesis markdown and optional Gamma deck request payload.

### Request body

- `period_start`
- `period_end`
- `top_assets[]`
- `top_learnings[]`
- `kills[]`
- `scale_recommendations[]`

### Outputs

- markdown saved in `marketing/reports/`
- optional Gamma payload for deck creation

## Worker Mapping

Heavy jobs should map to worker jobs like this:

- `process-sample`: sample page, proof pair, simple preview assets
- `process-paid-order`: book preview, cover variants, proof videos based on approved page outputs
- future marketing-specific jobs can be added later if throughput demands separation

## Implementation Notes

- the first implementation can live in `apps/web/app/api/internal/marketing/*`
- shared request and response types should move into `packages/shared` once the endpoints are real
- metrics ranking logic should ideally live in a shared package so the worker and admin UI can both reuse it
