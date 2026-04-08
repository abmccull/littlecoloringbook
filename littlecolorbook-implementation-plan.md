# littlecolorbook.com Engineering Implementation Plan

Draft v1.0  
Date: April 7, 2026

## 1. Goal

Turn the PRD into a buildable v1 that supports:

- free one-page sample generation
- paid PDF orders
- paid print orders fulfilled through Lulu
- admin recovery for failed pages and failed print jobs

This plan assumes a single codebase for the marketing site and app, plus a separate worker runtime for async jobs.

## 2. Delivery Model

### Recommended architecture

- `Next.js` app on `Vercel`
- `Postgres` for system-of-record data
- `Google Cloud Storage` for uploaded images and final print assets
- `Cloud Run` workers for long-running generation and fulfillment jobs
- `Cloud Tasks` for durable background queueing
- `Stripe Checkout` for payments
- `Lulu Print API` for print fulfillment

### Recommended repo layout

- `apps/web`
- `apps/worker`
- `packages/db`
- `packages/config`
- `packages/shared`
- `packages/email`
- `packages/pipeline`

### Suggested staffing

- 1 full-stack engineer can build the v1
- 1 designer or strong frontend contractor is helpful for the marketing site and core funnel
- Founder should own proof approval, sample asset selection, and early support review

## 3. Milestones

### Milestone 0: Benchmark and proof

Outcome:

- lock AI provider strategy
- confirm cleanup quality
- approve physical print proofs

Exit criteria:

- 30-photo benchmark set completed
- 2-3 printed proof books approved
- final print spec confirmed
- target unit economics confirmed

### Milestone 1: Platform foundation

Outcome:

- web app, database, storage, worker, secrets, and observability are online

Exit criteria:

- local and hosted environments boot successfully
- uploads can be stored and referenced
- background jobs can be dispatched and tracked

### Milestone 2: Free sample funnel

Outcome:

- cold traffic can request a one-page sample and receive it by email

Exit criteria:

- `/sample` flow works end-to-end
- sample delivery emails send successfully
- sample-ready page shows upgrade offers

### Milestone 3: Paid PDF ordering

Outcome:

- customers can place and receive digital orders without manual intervention

Exit criteria:

- 30-design default offer flow is live
- Stripe payment and PDF generation work end-to-end
- download portal is accessible by magic link

### Milestone 4: Paid print ordering

Outcome:

- customers can place print orders with live Lulu shipping options and automatic print submission

Exit criteria:

- shipping quotes work
- Stripe payment captures print + shipping
- final files submit successfully to Lulu

### Milestone 5: Admin ops and launch readiness

Outcome:

- founder can monitor orders, recover failures, and handle replacements

Exit criteria:

- admin queue and rerender tools work
- support runbook exists
- analytics and alerts are live

## 4. Epic Breakdown

## Epic 0: Benchmarking and Proofing

Objective:

- de-risk quality and cost before feature buildout

Tickets:

- `E0-T1` Build a benchmark input set of 30 representative family photos
- `E0-T2` Compare default and fallback image-generation providers on the same benchmark set
- `E0-T3` Build a cleanup prototype using Pillow and OpenCV
- `E0-T4` Define page QA heuristics and rejection thresholds
- `E0-T5` Generate proof interiors and covers for 30, 50, and 100 design books
- `E0-T6` Order physical proofs from Lulu and document print findings
- `E0-T7` Lock model defaults, retry rules, and print-safe export settings

Acceptance:

- benchmark results are documented
- proof outputs are approved
- the generation recipe is frozen for MVP

## Epic 1: Platform Foundation

Objective:

- establish the system foundation for web, data, storage, jobs, and observability

Tickets:

- `E1-T1` Initialize monorepo with `web`, `worker`, and shared packages
- `E1-T2` Provision `Postgres`, `Google Cloud Storage`, and worker deployment targets
- `E1-T3` Create environment-variable strategy for local, preview, and production
- `E1-T4` Set up database migrations and typed access layer
- `E1-T5` Implement object-storage helpers and signed upload/download URL utilities
- `E1-T6` Set up `Cloud Tasks` dispatch from the app to workers
- `E1-T7` Add `Sentry`, structured logs, and basic operational dashboards
- `E1-T8` Add analytics event pipeline using `PostHog` and `GA4`

Acceptance:

- a draft order can be created in the database
- an upload can be stored in cloud storage
- a worker can process a test job and update order state

## Epic 2: Marketing Site and Free Sample Funnel

Objective:

- ship the customer-facing surfaces that turn traffic into sample leads

Tickets:

- `E2-T1` Build homepage with hero, trust bar, before/after proof, use cases, guarantees, and final CTA
- `E2-T2` Build free-sample landing page optimized for one-photo upload
- `E2-T3` Build examples gallery page with reusable before/after layout
- `E2-T4` Build main product page featuring 30, 50, and 100 design offers
- `E2-T5` Build FAQ, shipping, privacy, terms, and refund pages
- `E2-T6` Implement sample upload form with email capture
- `E2-T7` Build sample processing page with in-progress state and upgrade block
- `E2-T8` Build sample-ready page with preview image, CTA, and default 30-design upgrade

Acceptance:

- cold traffic can enter through the free-sample path
- users can upload one photo and enter email
- sample-ready page shows a real output and upgrade CTA

## Epic 3: Paid Order Builder and Checkout

Objective:

- let customers configure, pay for, and start production of PDF or print orders

Tickets:

- `E3-T1` Create order draft creation flow for paid products
- `E3-T2` Build multi-photo upload UI with progress, retry, and thumbnail previews
- `E3-T3` Build product configuration state with default 30-design selection
- `E3-T4` Add cover personalization fields: child first name and optional dedication
- `E3-T5` Implement print-specific address and phone collection
- `E3-T6` Create shipping-quote UX for print orders
- `E3-T7` Create Stripe Checkout session builder for PDF and print orders
- `E3-T8` Build order confirmation screen and post-payment routing
- `E3-T9` Store payment metadata and idempotency keys for all checkout sessions

Acceptance:

- customer can complete a PDF or print purchase
- order is persisted with the correct selected offer and shipping method
- Stripe payment webhooks reconcile correctly

## Epic 4: Upload Processing and Generation Pipeline

Objective:

- transform uploaded family photos into production-ready coloring pages

Tickets:

- `E4-T1` Normalize uploads for orientation, format, and size
- `E4-T2` Implement upload validation and photo-quality checks
- `E4-T3` Build page-plan generator for sample, 10, 30, 50, and 100 design flows
- `E4-T4` Implement provider adapter for primary image generation model
- `E4-T5` Implement fallback generation lane for failed pages
- `E4-T6` Build page cleanup pipeline using thresholding, denoise, line strengthening, and margin normalization
- `E4-T7` Implement page-level QA scoring and reject/regenerate rules
- `E4-T8` Record prompt version, provider, model, and cleanup version per page

Acceptance:

- every accepted page has a source photo, generation record, QA result, and final asset reference
- failed pages can be retried individually

## Epic 5: PDF and Print Asset Assembly

Objective:

- turn accepted pages into downloadable and printable deliverables

Tickets:

- `E5-T1` Build interior-page compositor for digital and print flows
- `E5-T2` Build print-safe cover generation logic
- `E5-T3` Assemble final interior PDF for digital orders
- `E5-T4` Assemble final interior PDF and cover PDF for print orders
- `E5-T5` Validate page dimensions, bleed, margins, and file access for Lulu
- `E5-T6` Store final assets and attach them to the order record
- `E5-T7` Generate preview thumbnails for order portal and admin review

Acceptance:

- PDF orders produce downloadable final files
- print orders produce Lulu-ready interior and cover PDFs

## Epic 6: Lulu Fulfillment

Objective:

- automate print fulfillment after successful payment and file readiness

Tickets:

- `E6-T1` Implement Lulu auth and API client wrapper
- `E6-T2` Implement shipping-options request and response persistence
- `E6-T3` Implement print-job submission
- `E6-T4` Implement automatic payment flow for submitted API orders
- `E6-T5` Implement Lulu status sync worker
- `E6-T6` Store shipment tracking and surfaced delivery estimates
- `E6-T7` Build failure handling for rejected files and failed submissions
- `E6-T8` Build replacement-order path for damaged or misprinted books

Acceptance:

- print orders can move from `paid` to `submitted_to_lulu` automatically
- tracking data is visible in the customer portal and admin

## Epic 7: Customer Notifications and Lifecycle

Objective:

- make the order experience clear and create follow-on revenue opportunities

Tickets:

- `E7-T1` Build transactional email templates for sample, confirmation, PDF ready, print submitted, and shipped
- `E7-T2` Implement magic-link portal access emails
- `E7-T3` Build free-sample nurture sequence
- `E7-T4` Build buyer follow-up sequence for extra copy and reorder offers
- `E7-T5` Implement post-sample upgrade flow with 30-design default
- `E7-T6` Implement post-PDF print upsell
- `E7-T7` Implement post-print extra-copy upsell

Acceptance:

- all key lifecycle emails send with the correct order state
- post-sample and post-purchase upsells are measurable

## Epic 8: Customer Portal and Admin Operations

Objective:

- provide self-serve order visibility for customers and recovery tools for operators

Tickets:

- `E8-T1` Build customer order portal with magic-link token access
- `E8-T2` Show PDF download states and shipping states in the portal
- `E8-T3` Build admin orders list with filtering by email, order ID, and Lulu ID
- `E8-T4` Build per-order admin detail page with uploads, generated pages, and assets
- `E8-T5` Add page rerender action and selective page replacement
- `E8-T6` Add Lulu resubmit and replacement actions
- `E8-T7` Add refund notes and support action audit log

Acceptance:

- founder can recover common operational failures without direct database access

## Epic 9: QA, Analytics, and Launch Readiness

Objective:

- ensure launch stability and measurement

Tickets:

- `E9-T1` Instrument funnel analytics for sample conversion, paid conversion, and upsells
- `E9-T2` Add alerting for failed jobs, stalled jobs, and payment-to-generation gaps
- `E9-T3` Build manual smoke-test checklist for sample, PDF, and print paths
- `E9-T4` Run preview-environment QA on desktop and mobile
- `E9-T5` Run end-to-end test orders through Lulu sandbox and production-safe validation flow
- `E9-T6` Finalize support runbook and launch dashboard

Acceptance:

- the team can observe funnel health and production health in real time

## 5. Recommended Build Sequence

### Week 1

- Epic 0 benchmark and proofs
- Epic 1 platform bootstrap
- Epic 2 homepage and sample landing page

### Week 2

- Epic 2 sample-ready flow
- Epic 3 order builder and Stripe integration
- Epic 4 upload normalization and generation adapter

### Week 3

- Epic 4 cleanup and QA pipeline
- Epic 5 PDF assembly
- Epic 7 transactional emails

### Week 4

- Epic 6 Lulu shipping quotes and print submission
- Epic 8 portal and admin basics
- Epic 9 analytics and QA

### Week 5

- hardening
- proof reruns
- funnel tuning
- first limited-customer launch

## 6. MVP Cut Line

Must-have before launch:

- homepage
- free sample landing page
- sample generation flow
- 30, 50, 100 main product page
- PDF ordering
- print ordering
- Stripe Checkout
- Lulu shipping quote and submission
- transactional emails
- customer portal
- admin recovery tools

Can wait until post-launch:

- sophisticated style selection
- international shipping
- hardcover product
- advanced discounting
- rich account system
- reorder from saved albums

## 7. Operational Dependencies

- Lulu Direct account with production credentials
- Stripe account with automatic tax configured
- domain and DNS for `littlecolorbook.com`
- email provider and sender-domain authentication
- storage and worker cloud accounts

## 8. Definition of Done

A feature is done only when:

- the happy path works in preview and production-like environments
- error states are handled and visible to the user when appropriate
- analytics events are instrumented
- logs and alerts are in place for failure modes
- support actions are documented if manual intervention is possible
