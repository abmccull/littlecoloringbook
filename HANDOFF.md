# Little Coloring Book -- Project Handoff Document

**Last updated:** April 16, 2026
**Author:** AI-assisted session handoff

---

## 1. Project Overview

**Little Coloring Book** is an AI-powered product that turns family photos into personalized coloring books for children. A parent or grandparent uploads photos of their kid, pet, or family moments, and the system generates clean black-and-white coloring pages using Google Gemini's image generation models.

**Target customer:** Parents and grandparents of children ages 2-10. The core emotional hook is that children recognize themselves on the pages, which makes them actually want to color.

**Business model:**
- Free sample: 1 photo becomes 1 coloring page (email required). This is the lead magnet and sales mechanism.
- Paid tiers: PDF downloads ($29-$59) and spiral-bound printed books ($49-$99) via Lulu print-on-demand.
- Revenue comes from the conversion of free sample users to paid book orders.

**Domain:** littlecolorbook.com

---

## 2. Architecture

### Monorepo Structure

```
littlecolorbook/
  apps/
    web/          -- Next.js 16 frontend + API routes (deployed to Vercel)
    worker/       -- BullMQ job processor (deployed to Railway)
  packages/
    db/           -- Drizzle ORM schema, migrations, database client
    email/        -- Transactional email templates (Resend)
    jobs/         -- BullMQ job definitions and types
    pdf-templates/-- PDF assembly: cover, interior, occasion themes, fonts
    pipeline/     -- Gemini image generation + post-processing pipeline
    queue/        -- BullMQ queue setup and Redis connection
    shared/       -- Shared types, env config, GCS storage helpers, offer codes
  services/
    coloring-engine/ -- Legacy/experimental ControlNet-based pipeline (not active)
  scripts/        -- Benchmarking, training, seed, smoke tests
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Drizzle ORM with migration files |
| Job Queue | BullMQ + Redis |
| AI Generation | Google Gemini (gemini-3.1-flash-image-preview, gemini-3-pro-image-preview) |
| Image Processing | Sharp (normalize, threshold, erode, speckle cleanup) |
| PDF Assembly | pdf-lib |
| Payments | Stripe (checkout sessions, webhooks) |
| Print Fulfillment | Lulu Direct API (print-on-demand) |
| File Storage | Google Cloud Storage (uploads bucket, exports bucket) |
| Email | Resend |
| Analytics | PostHog, Google Analytics, Vercel Analytics |
| Auth | Clerk (referenced in deps but guest-first checkout flow) |
| Package Manager | npm 10.9.2 with workspaces |
| Node Version | 24.x |

### Deployment

| Service | Platform | Details |
|---------|----------|---------|
| Web app | Vercel | Project ID: `prj_BCpXxVrgR5hMiFtRUrHJ4D0Mc8tC`, Team: `team_dCOrrpLuYaV6tvTwJ3ursC29`, Root directory: `apps/web` |
| Worker | Railway | Runs BullMQ processor, connects to same Neon DB and Redis |
| Database | Neon | Serverless PostgreSQL |
| Redis | Railway (or external) | Used by BullMQ for job queuing |
| File Storage | Google Cloud Storage | Two buckets: uploads (private) and exports (private) |

---

## 3. Current State of Production

### What is deployed and working
- Homepage with Hormozi-rewritten copy (hero, callouts, proof gallery, use cases, guarantees, FAQs)
- Free sample funnel: email entry, photo upload, Gemini generation with progress bar + gallery carousel, sample ready page with download
- Rate limiting on free samples: 1 per email (forever), 1 per visitor (forever), 2 per IP (forever)
- Stripe checkout integration for paid orders
- Parallel Gemini generation for full book orders (p-limit concurrency)
- PDF assembly pipeline (cover + interior pages)
- Attribution tracking (UTM params, first-touch/last-touch, visitor ID, session ID)
- PostHog and GA analytics instrumentation

### What is built but not fully tested end-to-end
- Print fulfillment via Lulu API (daily batch submission). The code exists but has not been tested with a real production print order through to delivery.
- Post-purchase setup flow (upload photos, customize, confirm) for paid orders.
- Email delivery of completed PDFs (Resend integration exists but delivery flow needs validation).
- Occasion-themed PDF templates (4 occasion themes, 3 style components in pdf-templates package).

### Known issues / incomplete features
- Social proof quotes on the site are placeholder, not from real customers.
- Value stack bonuses (Coloring Party Kit, Memory Vault, Photo Picker Guide) are defined in code (`consumer-content.ts`) but not rendered in the UI.
- Urgency messages (sample expiry, seasonal cover) are defined in code but not wired into the UI.
- The 10-page PDF option (`pdf-10`) still exists in code as a downsell despite business advisor recommendation to remove it.
- No email automation sequences (abandoned sample follow-up, post-purchase nurture).
- No A/B testing infrastructure for the copy rewrite.

---

## 4. Coloring Engine History

### Timeline

**Pre-April 2026: ControlNet-based pipeline (original approach)**
- Built a Python-based coloring engine using ControlNet lineart extraction + various processing steps.
- Extensive configuration for contour cores, YOLO masks, repair zones, MLSD structure, dense scene rerouting, subject focus rerouting, vector cleanup, and speckle removal.
- The `.env.example` still contains all these `COLORING_ENGINE_*` variables.
- Code lives in `services/coloring-engine/` and various `scripts/` files.

**April 16, 2026: Attempted SDXL + IP-Adapter + LoRA approach**
- Abandoned the pix2pix-turbo paired model (insufficient capacity, faint gray output, no backgrounds).
- Built new stack: SDXL 1.0 + IP-Adapter-plus + Lineart ControlNet + Custom LoRA on a rented RTX 4090 (Vast.ai).
- Best parameters found: IP-Adapter scale 0.35, ControlNet 0.7, guidance scale 10-12, 30-40 steps, ~9-10s/image.
- Problems: generic/cartoony faces, scene drift, gray shading from off-the-shelf LoRA.
- Custom LoRA training started on 790 Gemini-generated targets but quality gap remained too large.

**April 16, 2026: Pivoted back to Gemini as production renderer**
- Decision: Gemini produces near-perfect coloring pages. The 60-90s latency is acceptable with engaging wait-state UI (gallery carousel, rotating facts, progress bar).
- Cost tradeoff: ~$0.02-0.05/image on Gemini vs ~$0.003-0.005/image on dedicated GPU. Accepted for now given quality difference.
- The Vast.ai GPU instance has been shut down.
- All SDXL/IP-Adapter/LoRA code and the `services/coloring-engine/` directory remain in the repo but are NOT the active production path.

### Why Gemini won
1. Perfect coloring page quality with consistent style.
2. Faces are recognizable (the core product promise).
3. Rate limits support parallel generation (100 RPM on Flash).
4. No GPU infrastructure to manage.
5. Latency is masked by good UX during the wait.

---

## 5. Gemini Pipeline

The active production pipeline lives in `packages/pipeline/src/index.ts`.

**Primary model:** `gemini-3.1-flash-image-preview` (100 requests per minute)
**Fallback model:** `gemini-3-pro-image-preview` (20 requests per minute)

**Generation flow:**
1. Source photo is downloaded from GCS.
2. Gemini is called with the photo + a carefully tuned prompt (version `2026-04-12.a`).
3. On 429 (rate limit), exponential backoff retry with fallback to the Pro model.
4. Parallel generation via `p-limit` with concurrency controlled by `PIPELINE_CONCURRENCY` env var (default: 20).

**Post-processing pipeline (Sharp):**
1. Normalize grayscale
2. Threshold to line art (black/white)
3. Remove speckles (minimum component size: 1200px)
4. Strengthen outlines (erode)
5. Safe margin check

**QA checklist (automated):**
- Subject readable
- Background clean
- Trim safe
- Line weight consistent
- Kid-friendly detail level

**Output:** 2400x3105px raster images, assembled into PDF via pdf-lib.

**PDF assembly:** The `packages/pdf-templates` package handles cover generation, interior layout, occasion themes (e.g., birthday, holiday), spine width calculation for print, and page count parity enforcement for Lulu's requirements.

---

## 6. Customer Flow (Current)

```
Homepage
  |
  v
"See My Free Coloring Page" CTA
  |
  v
/sample -- Email + child's first name form
  |
  v
Photo upload (single photo)
  |
  v
/sample/processing -- 90-second wait with:
  - Animated progress bar
  - Gallery carousel of example before/after
  - Rotating coloring facts
  |
  v
/sample/[token] -- Sample ready page
  - Preview of the generated coloring page
  - ONE primary CTA: "Build My Family Memory Book" (pdf-50, $39)
  - Secondary: spiral book upsell
  - Below fold: other sizes
  |
  v
/create?offer=pdf-50 -- Stripe checkout
  |
  v
Post-purchase setup flow:
  - Upload remaining photos
  - Customize (cover name, dedication text, occasion)
  - Confirm
  |
  v
Generation (parallel Gemini calls) --> PDF assembly --> Email delivery
  |
  v
(If print order) Daily batch submission to Lulu --> Ship to customer
```

**Rate limiting:**
- 1 free sample per email address (forever)
- 1 free sample per visitor ID (forever)
- 2 free samples per IP address (forever)

**Print orders:** Batched daily via Lulu Direct API. PDF is emailed within minutes; printed spiral book ships separately.

---

## 7. Offer Structure

Three named tiers (MAGIC-formula naming applied):

| Tier | Name | Pages | PDF Price | Print Price | Positioning |
|------|------|-------|-----------|-------------|-------------|
| Starter | The Starter Book | 30 | $29 | $49 | "Easy first book" |
| Featured | The Family Memory Book | 50 | $39 | $64 | "Most families pick this" |
| Complete | The Complete Keepsake Collection | 100 | $59 | $99 | "Best value" |

**Note:** A 10-page PDF option (`pdf-10`, $14) still exists in the codebase as a downsell but the business advisor recommends removing it.

**Guarantees (implemented in copy):**
1. **The Light-Up-Their-Face Guarantee** -- Full refund if the child doesn't love it. No questions.
2. **The Perfect Page Promise** -- Any page regenerated free until you love it.
3. **Keepsake Quality or Free Replacement** -- Spiral book arrives perfect or replaced at no cost.

**Planned bonuses (defined in code, not yet rendered in UI):**
- The Coloring Party Kit ($29 value) -- Printable cover sheet, tips, "About the Artist" page
- The Memory Vault ($19 value) -- Permanent digital access to re-download/re-order
- Best Photo Picker Guide ($9 value) -- Checklist of which photo types work best

---

## 8. Business Advisor Analysis Summary

A comprehensive Hormozi framework analysis was completed on April 16, 2026. Key findings:

**Value Equation Score: 2.5/10** (target for a strong consumer offer: 5+)

| Variable | Score | Issue |
|----------|-------|-------|
| Dream Outcome | 6/10 | Undersold. Copy describes the product, not the transformation. |
| Perceived Likelihood | 5/10 | Zero real social proof. No testimonials, no customer count. |
| Time Delay (inverted) | 7/10 | Actually a strength. 90-second sample, fast PDF delivery. |
| Effort & Sacrifice (inverted) | 6/10 | Decision fatigue from too many options. Photo selection anxiety. |

**Top 3 problems:**
1. Zero real social proof (biggest conversion killer)
2. Too many options too early (option overload cools warm leads)
3. Offer is a commodity product, not a Grand Slam Offer (no bonuses, no scarcity, no urgency, no value stack)

**What has been implemented from the analysis:**
- Hormozi copy rewrites across homepage, sample pages, and upsell pages
- MAGIC offer naming (Starter Book, Family Memory Book, Complete Keepsake Collection)
- Single primary CTA on sample-ready page (Family Memory Book)
- Named guarantees with remedy language
- Urgency/bonus data structures defined in `consumer-content.ts`

**What still needs to be done:**
- Collect real customer testimonials (email survey to existing customers)
- Render value stack bonuses in the UI
- Wire urgency messages into the sample-ready page
- Seasonal covers and limited-edition promotions
- A/B test new copy vs. old

Full analysis: `/tasks/business-advisor-analysis.md`

---

## 9. Database

**Provider:** Neon (serverless PostgreSQL)
**ORM:** Drizzle ORM
**Schema file:** `packages/db/src/schema.ts`
**Migrations directory:** `packages/db/drizzle/`

### Key Tables

| Table | Purpose |
|-------|---------|
| `customers` | Email, phone, first name, marketing opt-in |
| `orders` | Core order record. Links to customer, tracks status through full lifecycle (draft -> paid -> generating -> pdf_ready -> shipped). Contains offer code, design count, pricing, Stripe IDs, Lulu print job ID, attribution fields (UTM, visitor ID, session ID, first/last touch). |
| `order_addresses` | Shipping address for print orders |
| `portal_tokens` | Secure token-based access to order status/download pages (hashed, expiring) |
| `uploads` | Customer photo uploads. Tracks presigned URL status, object path in GCS. |
| `assets` | Generated artifacts: normalized images, generated pages, previews, interior PDF, cover PDF, download PDF |
| `generation_jobs` | Tracks Gemini generation jobs (sample or full_book). Records provider, model, prompt version, cleanup version, accepted page count. |
| `generation_pages` | Individual page generation results within a job |
| `fulfillment_jobs` | Lulu print fulfillment tracking (draft -> submitted -> in_production -> shipped -> delivered) |

### Order Status Lifecycle
```
draft -> awaiting_payment -> paid -> preprocessing -> generating -> qa_review ->
assembling_pdf -> pdf_ready -> awaiting_print_submission -> submitted_to_lulu ->
in_production -> shipped -> delivered
```
Also: `failed`, `support_required`, `refunded`

### Migrations Applied
```
0000_outgoing_stick.sql
0001_clean_runaways.sql
0002_glamorous_harpoon.sql
0003_light_azazel.sql
0004_wakeful_living_lightning.sql
0005_yellow_anthem.sql
0006_add_client_ip_to_orders.sql  (latest)
```

---

## 10. Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `APP_URL` | Base URL for the web app (e.g., `https://littlecolorbook.com`) |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_ACCOUNT_ID` | Stripe Connect account ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `LULU_CLIENT_KEY` | Lulu Direct API client key |
| `LULU_CLIENT_SECRET` | Lulu Direct API client secret |
| `LULU_API_BASE_URL` | Lulu API base (`https://api.lulu.com`) |
| `LULU_POD_PACKAGE_ID` | Lulu print-on-demand package specification |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (used by Vercel AI SDK) |
| `GEMINI_API_KEY` | Gemini API key (used by pipeline directly) |
| `GCS_PROJECT_ID` | Google Cloud project ID |
| `GCS_CLIENT_EMAIL` | GCS service account email |
| `GCS_PRIVATE_KEY` | GCS service account private key |
| `GCS_BUCKET_UPLOADS` | GCS bucket for customer photo uploads |
| `GCS_BUCKET_EXPORTS` | GCS bucket for generated PDFs and assets |
| `RESEND_API_KEY` | Resend email API key |
| `REDIS_URL` | Redis connection URL for BullMQ |
| `WORKER_CONCURRENCY_PROCESS_SAMPLE` | Worker concurrency for sample jobs (default: 2) |
| `WORKER_CONCURRENCY_PROCESS_PAID_ORDER` | Worker concurrency for paid order jobs (default: 1) |
| `WORKER_CONCURRENCY_SUBMIT_LULU` | Worker concurrency for Lulu submissions (default: 1) |
| `CRON_SECRET` | Secret for authenticated cron job endpoints |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics project key for the browser client |
| `POSTHOG_API_KEY` | PostHog project key for server-side capture/identify calls |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics measurement ID |
| `COLORING_ENGINE_*` | Legacy coloring engine config (not used in production Gemini path) |

See `.env.example` for the complete list with placeholder values.

---

## 11. Recent Commits (Last 30)

```
3a92b5c Revert rate limit try-catch workaround, migration applied
63ef822 Fix sample API 500 + portrait page-peek + before/after on sample page
0475769 Commit remaining uncommitted route and component changes
bee3e05 Fix Vercel build: commit marketing-runtime.ts with primaryProvider
1a1bf9c Rewrite all customer-facing copy using Hormozi frameworks
111e7c9 Add jobs and queue workspace deps to web app package.json
34169e5 Add missing packages/jobs and packages/queue to fix Vercel build
ba5b8f8 Rate limit free samples + reorder funnel to purchase-first
fc450eb Parallelize Gemini generation, add gallery wait UI, upsells, batch print
aa83b9e Set maxDuration on generation job routes to prevent timeout
df66217 Fix frozen progress bar and add rotating coloring facts
0df6c23 Lazy-import React-PDF renderers to fix sample job crash
f69ea2d Fix sample landing page layout and show progress bar immediately
2a2d98c Fix sample funnel: upload bug, progress bar, email delivery
0cda25b Fix deploy: strip .js extensions, add occasion picker + preview route
f782d9d Wire pdf-templates render pipeline into order materialization
108de7a Add fonts, 3 style components, and 4 occasion themes to pdf-templates
d1a928f Add packages/pdf-templates -- design system for Lulu-ready coloring book PDFs
4c15b23 Replace CSS-faked spiral book preview with real mockup image
f5a1d4a Reorder hero so sample image sits under subtext on mobile
753e499 Simplify mobile homepage hero
21de24e Tighten mobile homepage hero layout
6921a93 Fix production uploads and improve mobile homepage
0d26798 Adjust homepage hero callout layout
248728c Fix upload flow and polish sample funnel
917af21 Refine homepage hero layout and proof copy
f407029 Persist attribution and capture first-touch marketing data
88da19b Add attribution cookie helper
0c6d35e Add interactive hero proof slider
e3c81f0 Use real proof assets in homepage hero
```

---

## 12. What Needs to Be Done Next

### High Priority (Do First)

1. **Collect real customer testimonials.** This is the single biggest conversion lever. Email every customer who has ordered and ask: "What did your kid do when they saw the coloring page?" Replace the placeholder quotes with real responses including first name and city.

2. **End-to-end print fulfillment test.** Place a real print order through the full Lulu pipeline (order -> submission -> production -> shipping -> delivery) and verify the physical product quality.

3. **A/B test the Hormozi copy rewrite.** The copy was fully rewritten but there is no measurement of impact. Set up a simple A/B test (even just time-based) to compare conversion rates.

### Medium Priority (Do This Month)

4. **Seasonal urgency and limited-edition covers.** Mother's Day is the immediate opportunity. Design a seasonal cover template and add urgency messaging ("Order by [date] for guaranteed Mother's Day delivery").

5. **Render value stack bonuses in the UI.** The bonus data (Coloring Party Kit $29, Memory Vault $19, Photo Picker Guide $9) is defined in `consumer-content.ts` but not displayed on any page. Add a "What you're getting" value stack section to the sample-ready page showing total value vs. price.

6. **Email automation sequences:**
   - Abandoned sample follow-up (user generated sample but didn't buy)
   - Post-purchase nurture (delivery confirmation, "share with grandparents" prompt, review request)
   - Cart abandonment (started checkout but didn't complete)

7. **Wire urgency messages into UI.** The `urgencyMessages` object in `consumer-content.ts` has sample expiry and seasonal cover messages but they are not rendered.

### Lower Priority (Do Next Month)

8. **Flip the sample flow: photo first, email second.** The business advisor analysis strongly recommends letting users upload a photo before asking for email. This is a significant refactor of the sample creation flow.

9. **Remove the 10-page option.** Kill `pdf-10` from consumer-facing pages to reduce decision fatigue.

10. **Subscription model exploration.** $12/month for a fresh 10-page mini-book delivered monthly. Would dramatically increase LTV.

11. **Shareable sample output.** Add "Share on Instagram" with a branded frame for viral distribution.

---

## 13. Important Files Reference

### Web App (`apps/web/`)

| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage |
| `app/sample/page.tsx` | Sample entry (email + name form) |
| `app/sample/processing/page.tsx` | Sample wait page (progress bar, gallery, facts) |
| `app/sample/[token]/page.tsx` | Sample ready / upsell page |
| `app/sample/limit-reached/page.tsx` | Rate limit reached page |
| `app/create/page.tsx` | Book builder / checkout flow |
| `lib/consumer-content.ts` | All consumer-facing copy, offers, guarantees, FAQs, bonuses, urgency messages |
| `lib/marketing-runtime.ts` | Marketing provider configuration |

### Packages

| Package | Key File(s) | Purpose |
|---------|------------|---------|
| `packages/pipeline/src/index.ts` | Main export | Gemini generation, post-processing, PDF assembly |
| `packages/db/src/schema.ts` | Schema | All Drizzle table definitions |
| `packages/db/drizzle/` | Migrations | SQL migration files (0000-0006) |
| `packages/pdf-templates/` | Templates | Cover design, interior layout, occasion themes, fonts, Lulu trim specs |
| `packages/shared/` | Types, env | Shared types (OfferCode, etc.), env config, GCS storage helpers |
| `packages/email/` | Templates | Transactional email templates via Resend |
| `packages/jobs/` | Job defs | BullMQ job type definitions |
| `packages/queue/` | Queue setup | BullMQ queue creation and Redis connection |

### Worker (`apps/worker/`)

| Purpose |
|---------|
| BullMQ processor that handles: sample generation, paid order generation, Lulu submission, Lulu status sync |

### Legacy (Not Active Production Path)

| Path | Purpose |
|------|---------|
| `services/coloring-engine/` | Python-based ControlNet pipeline (archived) |
| `scripts/setup-img2img-turbo.py` | pix2pix-turbo training setup (archived) |
| `scripts/run-pix2pix-turbo.py` | pix2pix-turbo training/inference (archived) |
| `scripts/benchmark-*.mjs` | Renderer benchmarking tools |
| `scripts/generate-teacher-targets.ts` | Gemini target generation for LoRA training |

---

## 14. Credentials and Services

All secrets are stored as environment variables. Never commit actual values. See `.env.example` for the full template.

| Service | What to look for | Notes |
|---------|-----------------|-------|
| Neon (PostgreSQL) | `DATABASE_URL` | Serverless Postgres. Dashboard at console.neon.tech. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ACCOUNT_ID` | Test keys start with `sk_test_` / `pk_test_`. Webhook secret starts with `whsec_`. |
| Lulu Direct | `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` | OAuth2 client credentials. Auth token URL in env. POD package ID specifies the book format (7x10 coil, 60gsm uncoated cream interior, 4-color matte cover). |
| Google Cloud (Gemini) | `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | Same key, two env vars for different SDK entry points. |
| Google Cloud (Storage) | `GCS_PROJECT_ID`, `GCS_CLIENT_EMAIL`, `GCS_PRIVATE_KEY`, `GCS_BUCKET_UPLOADS`, `GCS_BUCKET_EXPORTS` | Service account credentials. Two buckets: one for raw uploads, one for generated exports. |
| Resend (Email) | `RESEND_API_KEY` | Transactional email. From address: `hello@littlecolorbook.com`. |
| Redis | `REDIS_URL` or `RAILWAY_REDIS_URL` | Used by BullMQ. Railway provides Redis; external Redis also supported. |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics. US cloud instance. |
| Google Analytics | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Web analytics. |
| Vercel | Managed via Vercel dashboard | Project: `littlecolorbook`, Team: `team_dCOrrpLuYaV6tvTwJ3ursC29` |
| Railway | Managed via Railway dashboard | Hosts the worker process and Redis |

---

## Quick Start for a New Developer

1. Clone the repo.
2. Copy `.env.example` to `.env` and fill in credentials.
3. `npm install` (workspaces will install all packages).
4. `npm run db:push` to sync schema to your database.
5. `npm run dev:web` to start the Next.js dev server.
6. `npm run dev:worker` to start the BullMQ worker (requires Redis).
7. Set up Stripe webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start web dev server |
| `npm run dev:worker` | Start worker dev server |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run db:generate` | Generate new Drizzle migration |
| `npm run db:push` | Push schema directly to database |
| `npm run db:studio` | Open Drizzle Studio (database browser) |
| `npm run check` | Full check: typecheck + build + smoke tests |
