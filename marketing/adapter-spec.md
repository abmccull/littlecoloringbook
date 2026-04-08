# OpenClaw Marketing Adapter Spec

## Purpose

This document defines the v1 adapter contract for the OpenClaw content operator.

It tells the agent how to:

- call internal product-asset tooling
- call Arcads for UGC-style wrappers
- call ElevenLabs for voice generation and dubbing
- call Gamma for creator kits and reporting
- ingest performance data from publishing, ads, and the website
- convert all of that into a repeatable test-and-learn loop

This is a v1 orchestration spec, not a final implementation spec for every provider SDK.

## System Goal

Produce high-volume, high-quality creative with a product-truth core, then route learning back into the next creative batch.

The loop is:

1. ingest performance
2. score assets and hypotheses
3. choose exploit, adjacent, and explore batches
4. generate new assets
5. QA and publish
6. nominate winners for paid
7. synthesize learnings
8. repeat

## Required Adapters

The agent should treat every external system as an adapter with a narrow contract.

### 1. Internal Product Asset Adapter

This is the most important adapter. It provides product-truth visuals.

#### Required capabilities

- generate a single sample coloring page from one uploaded image
- generate a multi-page book preview from an approved photo set
- generate side-by-side original-photo and coloring-page proof assets
- generate print mockups for Solo Keepsake, Sibling Set, and Sibling Trio
- generate cover variants with child name changes
- generate page-flip or book-preview video clips from approved pages
- export static assets in social-ready aspect ratios

#### Required inputs

- `source_asset_ids[]`
- `order_style` such as `sample`, `pdf_preview`, `print_mockup`, `bundle_mockup`
- `child_first_name`
- `offer_id`
- `page_count_offer`
- `bundle_offer`
- `occasion`
- `output_formats[]`
- `aspect_ratios[]`

#### Required outputs

- `asset_id`
- `asset_type`
- `source_asset_ids[]`
- `storage_url`
- `preview_url`
- `width`
- `height`
- `duration_ms` if video
- `offer_id`
- `page_count_offer`
- `bundle_offer`
- `occasion`
- `render_profile`
- `created_at`

#### Output asset types

- `sample_page`
- `before_after_pair`
- `book_preview_image`
- `book_preview_video`
- `print_mockup`
- `cover_variant`
- `ugc_b_roll`
- `thumbnail`

#### Guardrails

- only use approved and rights-cleared assets
- mark mockups clearly in metadata
- preserve which visuals are true customer assets versus generated demonstrations

### 2. Arcads Creative Wrapper Adapter

Use Arcads to create creator-style and talking-head wrappers around proven offers and scripts.

#### Required capabilities

- create avatar-led vertical videos from approved scripts
- batch-create multiple variants from one script family
- change actor, wardrobe, delivery, and shot style while preserving script intent
- insert product-truth overlays or book preview cutaways
- return subtitle files and raw/exported renders

#### Required inputs

- `script_id`
- `script_text`
- `avatar_id`
- `delivery_style`
- `visual_style`
- `platform`
- `duration_target`
- `cutaway_asset_ids[]`
- `cta_text`
- `offer_id`
- `occasion`

#### Required outputs

- `creative_id`
- `variant_id`
- `render_url`
- `subtitle_url`
- `avatar_id`
- `delivery_style`
- `duration_ms`
- `offer_id`
- `occasion`
- `created_at`

#### Arcads usage rules

- do not use Arcads as a substitute for product proof
- talking-head assets should support the product, not replace it
- at least half of each daily batch must have direct product proof in the first 2 seconds

### 3. ElevenLabs Voice Adapter

Use ElevenLabs for voiceovers, alternate reads, and dubbing of proven creatives.

#### Required capabilities

- text-to-speech generation
- voice selection from approved roster
- style variants for the same script
- multilingual dubbing for winners
- subtitle or transcript export

#### Required inputs

- `script_text`
- `voice_id`
- `voice_family`
- `emotion_style`
- `language`
- `speed`
- `output_format`

#### Required outputs

- `audio_asset_id`
- `audio_url`
- `voice_id`
- `voice_family`
- `language`
- `duration_ms`
- `transcript`
- `created_at`

#### Voice testing rules

- start with the approved four voice families only
- do not add a new voice unless the current roster is underperforming or a winner needs a close variant
- only dub proven English winners into Spanish in v1

### 4. Gamma Reporting and Enablement Adapter

Gamma is not part of the high-frequency content render loop.
Use it for packaging learning and enablement.

#### Required capabilities

- generate creator brief decks
- generate affiliate battlecards
- generate weekly or monthly performance summaries
- generate occasion-specific campaign one-pagers

#### Required inputs

- `report_type`
- `time_range`
- `top_assets[]`
- `top_learnings[]`
- `occasion`
- `offers[]`
- `creator_program_notes[]`

#### Required outputs

- `deck_id`
- `view_url`
- `export_url`
- `report_type`
- `created_at`

### 5. Performance Ingestion Adapter

This adapter normalizes performance data from TikTok, Instagram, Meta, website analytics, and ecommerce events.

#### Required sources

- TikTok organic post metrics
- Instagram Reel metrics
- Meta Ads metrics
- landing page analytics
- free-sample submissions
- purchase events
- print attach data
- sibling bundle attach data
- email click and conversion data

#### Canonical daily metrics schema

Every creative or ad row should normalize to:

- `asset_id`
- `platform`
- `account_id`
- `campaign_id`
- `adset_id`
- `ad_id`
- `publish_date`
- `report_date`
- `views`
- `impressions`
- `spend`
- `hook_rate`
- `hold_rate`
- `watch_through_rate`
- `ctr`
- `cpc`
- `cpm`
- `profile_visits`
- `shares`
- `saves`
- `comments`
- `landing_page_sessions`
- `landing_page_opt_ins`
- `opt_in_rate`
- `purchases`
- `purchase_rate`
- `revenue`
- `cac`
- `print_attach_rate`
- `bundle_attach_rate`
- `offer_id`
- `occasion`
- `persona_id`
- `voice_id`
- `format_id`

#### Scoring outputs

The adapter should compute:

- `organic_score`
- `paid_score`
- `winner_status`
- `fatigue_status`
- `recommended_action`

Possible `recommended_action` values:

- `exploit`
- `adjacent`
- `explore`
- `pause`
- `promote_to_paid`
- `localize`
- `retire`

## File and Folder Contracts

The OpenClaw operator should use these paths:

- `marketing/experiments/`: experiment definitions, result snapshots, and merged performance logs
- `marketing/queues/`: organic publish queues and paid nomination lists
- `marketing/reports/`: weekly and monthly synthesis docs or exports
- `marketing/briefs/`: creator briefs, affiliate kits, and occasion packs

### Required recurring files

- `marketing/experiments/current-registry.csv`
- `marketing/queues/today-organic-queue.json`
- `marketing/queues/today-paid-nominations.json`
- `marketing/reports/weekly-synthesis-YYYY-MM-DD.md`
- `marketing/reports/monthly-summary-YYYY-MM.md`

## Creative Build Pipeline

### Phase 1: Ingest

- load yesterday's metrics
- merge new rows into the experiment registry
- update winner and loser status
- flag creative fatigue

### Phase 2: Decide

- allocate 70-20-10 for mature accounts or 50-30-20 for early accounts
- choose exploit, adjacent, and explore hypotheses
- cap new variables so only one major change is tested per descendant asset

### Phase 3: Build

- request product-proof assets from internal tooling
- request avatar wrappers from Arcads where needed
- request voiceover or dubbing from ElevenLabs where needed
- compose final assets with subtitles and overlays

### Phase 4: QA

Reject any creative that:

- lacks product proof without approved exception
- uses weak or confusing mockups
- overstates claims
- mismatches landing-page offer
- introduces off-brand styling
- fails subtitle quality or safe-area checks

### Phase 5: Route

- organic winners go to publish queues
- high-confidence direct-response creatives go to paid nominations
- top English winners can be routed to localization
- top concepts with weak hooks go back to adjacent revision

## Decision Logic

### Organic winner threshold

A creative is an organic winner if it meets most of:

- top 20 percent hook rate for platform
- above-median watch-through
- above-median saves and shares
- strong profile visits or link clicks

### Paid winner threshold

A creative is a paid winner if it meets most of:

- thumbstop above baseline
- CTR above baseline
- CPL below target
- CAC below target or improving toward target
- contribution economics stronger than baseline

### Kill threshold

Pause or retire a creative if:

- hook rate is bottom quartile after enough impressions
- comments show distrust or confusion
- CPL is materially above target with no recovery trend
- the same angle has failed 3 times in a row without a meaningful variable change

## Reinforcement Loop

The agent should treat each daily batch as training data.

### Learn from winners

For every winner, persist:

- opening frame pattern
- hook family
- persona
- avatar
- voice family
- visual format
- occasion
- CTA
- offer mix

### Learn from losers

For every loser, record:

- what variable changed
- where the drop occurred
- whether the issue was hook, proof, trust, mismatch, or CTA friction

### Descendant rule

For any winner, create 3 to 5 descendants changing exactly one major variable:

- hook
- opening visual
- avatar
- voice
- CTA
- occasion framing
- runtime

## Environment and Secret Expectations

The OpenClaw environment should expose only the secrets needed for this workflow.

Suggested environment groups:

- internal rendering and asset tools
- Arcads credentials
- ElevenLabs credentials
- Gamma credentials if API access is available
- social and ads platform reporting credentials
- analytics or warehouse credentials

Do not give the content operator unnecessary access to payments, customer support inboxes, or unrelated repos.

## Recommended Build Order

1. internal product asset adapter
2. metrics ingestion adapter
3. Arcads adapter
4. ElevenLabs adapter
5. Gamma reporting adapter
6. publish and queue adapters

## First Integration Milestones

### Milestone 1

The agent can ingest metrics and produce a ranked daily plan.

### Milestone 2

The agent can request product-proof assets and create complete organic-ready videos.

### Milestone 3

The agent can route winners into paid nominations and localize proven winners.

### Milestone 4

The agent can produce weekly synthesis decks and creator briefs automatically.
