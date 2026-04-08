# littlecolorbook.com PRD

Draft v1.0  
Date: April 7, 2026  
Status: Working draft  
Product: littlecolorbook.com

## 1. Executive Summary

littlecolorbook.com is a web product that turns family photos into personalized coloring pages and coloring books for kids. Customers upload photos, choose a digital PDF or printed book, and receive either a downloadable file or a printed spiral-bound book shipped to their door.

The product is not a general AI art tool. It is a guided consumer workflow built around memory-driven personalization, low-friction checkout, predictable output quality, and automated fulfillment.

The launch recommendation is:

- One custom web app and marketing site on the same domain
- `Stripe Checkout` for payments
- Direct `Lulu Print API` integration for print fulfillment
- One print format only at launch
- US-only launch at first
- Free one-page sample as the top-of-funnel offer

The most important product constraint is that this is a custom job workflow, not normal catalog ecommerce. That is why the recommended v1 architecture is a custom web application instead of a Shopify-first implementation.

## 2. Product Vision

Turn real family memories into a screen-free activity and keepsake that feels personal, easy to buy, and giftable.

## 3. Problem Statement

Parents already have hundreds of meaningful photos, but there is no simple product that turns those photos into child-friendly coloring books without requiring design skills, manual editing, or complicated print prep.

Existing alternatives are weak in one of three ways:

- Generic coloring books are not personal
- AI image tools are too open-ended and too hard for normal parents
- Print-on-demand tools are not built around photo upload, cleanup, and child-friendly line-art output

## 4. Product Goals

### Business goals

- Validate paid demand for personalized coloring books
- Achieve a profitable v1 with low operational overhead
- Launch a digital SKU and a printed SKU from the same generation pipeline
- Build a reusable system that can later expand into themed books, holiday books, pet books, and gift flows

### User goals

- Upload photos easily from phone or desktop
- Get a result that feels like their child or family, not generic AI output
- Receive a PDF quickly
- Trust the printed product quality and delivery expectations

### Product goals

- Automate the flow end-to-end with minimal manual intervention
- Keep quality consistent enough that only edge cases need support review
- Minimize the number of customer choices at launch

## 5. Non-Goals for V1

- No marketplace for creators or custom designers
- No user-generated editing canvas
- No mobile app
- No international launch
- No multi-language support
- No multiple print formats at launch
- No hardcover offering at launch
- No customer proof-approval workflow before production
- No Shopify storefront as the primary commerce layer

## 6. Key Decisions

### 6.1 Commerce decision

V1 should use a custom web app plus `Stripe Checkout`, not Shopify.

Rationale:

- The customer is buying a generated job, not selecting a normal catalog SKU
- The app needs to collect uploads, run async generation, quote shipping from Lulu, and then fulfill a custom asset bundle
- Shopify adds complexity around custom products, shipping logic, and checkout customization without materially helping the core workflow
- `Stripe Checkout` is a better fit for one-time, custom-configured orders

### 6.2 Fulfillment decision

Use direct `Lulu Print API` integration instead of relying on a Shopify app.

Rationale:

- The app remains the source of truth for files, order states, and customer support
- Shipping can be quoted directly from Lulu before payment
- Print jobs can be submitted automatically after successful payment and file validation

### 6.3 Launch geography

Launch in the United States only.

Rationale:

- Simplifies taxes, shipping expectations, address validation, and support
- Reduces operational variability while the print workflow is being proven

### 6.4 Print product decision

Launch one print spec only:

- `US Letter`
- `Paperback Coil Bound`
- `Standard Black & White`
- `60# White Uncoated`
- `Gloss cover`
- One-sided coloring-page layout

Rationale:

- Best user experience for coloring because the book lies flat
- White uncoated stock fits crayons and colored pencils better than coated stock
- Minimizes SKU and file complexity

## 7. Target Users

### Primary buyer

- Parent, most often mom, age 28-42
- Has children roughly age 3-8
- Wants a meaningful, low-screen activity
- Comfortable buying personalized gifts or activities online

### Secondary buyer

- Grandparent, aunt, uncle, family friend
- More likely to purchase the printed version
- Higher gift intent, less tolerance for complicated setup

### Internal user

- Founder or support operator reviewing failed jobs, replacements, and customer issues

## 8. Value Proposition

littlecolorbook.com turns the photos families already love into a personalized coloring experience that is:

- emotional
- easy
- fast
- giftable
- screen-free

### Positioning guardrails

- Present the product as a personalized memory product, not an AI art tool
- Lead with emotional and practical outcomes, not model or prompt details
- Emphasize keepsake value, low-screen activity, and giftability
- Keep the experience guided and opinionated rather than open-ended

## 9. Success Metrics

### Funnel metrics

- Landing page conversion to free sample
- Free sample completion rate
- Free sample to paid conversion
- Paid checkout conversion
- PDF to print upsell conversion

### Product metrics

- Successful generation rate per order
- Average pages regenerated per order
- Median PDF delivery time by SKU
- Print submission success rate
- Print replacement/refund rate

### Business metrics

- Contribution margin by SKU
- Average order value
- CAC payback window
- Repeat purchase rate

### Proposed launch targets

- Free sample landing page conversion: `8%+`
- Free sample to paid conversion within 7 days: `5%+`
- Paid orders with no manual intervention: `85%+`
- PDF orders delivered within SLA: `95%+`
- Print orders submitted to Lulu within 1 business day: `95%+`
- Reprint/replacement rate: `< 3%`
- 30-design SKU share of first purchases: `50%+`
- PDF-to-print upsell conversion after digital purchase: `8%+`

## 10. Offer and Pricing

These prices are launch targets and should be revalidated against live API and print costs before launch.

### Free lead magnet

- `Free Memory Page`
- 1 uploaded photo
- 1 sample page
- Delivered by email
- Watermarked for v1
- Purpose: prove the product value before asking for a full order

### PDF SKUs

- `Mini Memory Pack` - 10 designs - `$14`
- `Signature Memory Book` - 30 designs - `$29`
- `Storybook Deluxe` - 50 designs - `$39`
- `Year of Memories` - 100 designs - `$59`

Merchandising roles:

- `Mini Memory Pack` is primarily an entry offer or downsell
- `Signature Memory Book` is the core front-end offer and default selection
- `Storybook Deluxe` is the primary value upgrade
- `Year of Memories` is the high-anchor tier

### Print SKUs

All printed books include the PDF.

- `Keepsake Spiral 30` - 30 designs - `$49 + shipping`
- `Keepsake Spiral 50` - 50 designs - `$64 + shipping`
- `Keepsake Spiral 100` - 100 designs - `$99 + shipping`

### Included in every paid order

- Personalized cover with child name
- Child-friendly line-art cleanup
- Print-ready formatting
- Re-download access to the PDF
- Up to 3 page re-renders if a few pages come out weak

### Launch rules

- Minimum album upload for paid books: `10 photos`
- Larger books can use multiple pages or variants from a single photo
- Print shipping is quoted live from Lulu and charged separately in v1
- Printed books use one-sided coloring-page layouts, so interior page counts will be higher than the customer-facing design count

### Print page-count mapping

Customer-facing design count should map approximately to these interior page ranges:

- 30 designs: about `64` interior pages
- 50 designs: about `104` interior pages
- 100 designs: about `204` interior pages

Final counts may shift slightly based on front matter, title pages, and blank backs.

### Guarantee structure

#### Preview Promise

The customer sees what the style looks like before committing to print.

#### Redo Promise

If a few pages miss the mark, littlecolorbook.com will redo up to 3 pages at no extra charge.

#### Arrival Promise

If a printed book arrives damaged or misprinted, littlecolorbook.com will replace it.

### Offer merchandising rules

- Cold traffic should enter through the free-sample flow
- The main product merchandising should lead with the `30`, `50`, and `100` design offers
- The `30-design` offer should be the default recommended paid choice
- Print should be framed as `Print + PDF`
- The `10-design` PDF should not be the primary hero offer on the main product page

## 11. Customer Promise and SLA

### Free sample

- Customer-facing promise: ready in `5-15 minutes`

### Paid PDF

- 10 designs: within `15 minutes`
- 30 designs: within `30 minutes`
- 50 designs: within `45 minutes`
- 100 designs: within `90 minutes`

### Printed books

- File generation and print submission: within `1 business day`
- Lulu production target: typically `3-5 business days`
- Transit time depends on selected shipping method

Important: faster shipping reduces transit time only. It does not reduce production time.

## 12. End-to-End User Flows

### 12.1 Free sample flow

1. Customer lands on free sample page
2. Uploads one photo
3. Enters email and optionally child first name
4. App creates sample generation job
5. Sample page is generated and cleaned up
6. Confirmation page shows that the sample is being created
7. If child first name was not collected earlier, it is collected during the wait state
8. Sample is shown on confirmation page and emailed
9. Upgrade offers are shown while the customer waits
10. The 30-design paid offer is presented as the default upgrade

### 12.2 Paid PDF flow

1. Customer enters from the product page or post-sample upgrade path
2. The 30-design option is preselected by default
3. Customer chooses design count and PDF format
4. Uploads the required photos
5. Adds child first name and optional dedication
6. Pays through Stripe Checkout
7. App starts async generation
8. Pages are generated, cleaned, QA-checked, and assembled into a PDF
9. Customer receives email and portal link to download the PDF
10. Post-purchase upsell offers a printed spiral-bound copy

### 12.3 Paid print flow

1. Customer enters from the product page, sample upsell, or post-PDF upsell
2. The 30-design option is preselected by default
3. Customer chooses design count and `Print + PDF`
4. Uploads photos
5. Adds child first name and optional dedication
6. Enters shipping address and phone number in app
7. App requests live shipping options from Lulu
8. Customer chooses shipping option
9. App creates Stripe Checkout session for book plus shipping
10. After payment, app generates final interior and cover PDFs
11. App submits print job to Lulu
12. Lulu validates, prints, packs, and ships
13. Customer receives status updates until delivered

### 12.4 Cold-traffic landing flow

1. Customer arrives from ad, Pinterest pin, creator mention, or organic content
2. Landing page leads with before/after examples and the free-sample offer
3. Customer uploads one photo and enters email
4. Customer receives a sample and is moved into the upgrade flow

Rule:

- Cold traffic should not be asked to upload 10 photos immediately

### 12.5 Order portal flow

1. Customer opens portal from magic link in email
2. Sees current order status
3. Downloads PDF if available
4. Sees tracking details for print orders once shipped
5. Can request help if something is wrong

### 12.6 Admin/support flow

1. Support opens admin dashboard
2. Reviews failed or flagged jobs
3. Re-runs pages or swaps bad source photos
4. Resubmits failed Lulu jobs
5. Marks replacement or refund actions
6. Resends confirmation, delivery, or tracking emails

## 13. Functional Requirements

### 13.1 Marketing site

Priority: `P0`

- Homepage with core value proposition
- Dedicated free sample landing page
- Product/pricing page
- Before-and-after gallery
- FAQ
- Use-case pages for SEO and paid traffic landing
- Legal pages: privacy, terms, refunds, shipping
- Homepage hero should lead with the free-sample CTA
- Homepage should include a trust bar with screen-free, personalized, speed, and shipped-to-door signals
- Homepage should include explicit before/after proof sections
- Main product merchandising should lead with 30, 50, and 100 design options
- Messaging should emphasize PDF or spiral-bound keepsake, not AI tooling

### 13.2 Upload and builder

Priority: `P0`

- Drag-and-drop and mobile camera roll upload
- Multi-file upload with progress states
- File type support: `JPG`, `PNG`, `HEIC` if feasible
- Basic client-side limits and validation
- Server-side validation for size, corruption, and orientation
- Preview thumbnails before purchase

### 13.3 Photo suitability checks

Priority: `P0`

- Detect unusable uploads such as corrupt files
- Flag very blurry or low-resolution photos
- Reject unsupported file types
- Deduplicate exact duplicates where possible
- Moderate for disallowed content

### 13.4 Personalization

Priority: `P0`

- Child first name on the cover
- Optional dedication line for the cover or title page
- Optional simple style selector only if it does not materially reduce output consistency

### 13.5 Generation pipeline

Priority: `P0`

- Create a page plan from uploaded photos
- Generate line-art pages from source photos
- Run cleanup pass for print-safe output
- QA score each page
- Regenerate only failed pages
- Maintain deterministic page ordering

### 13.6 PDF assembly

Priority: `P0`

- Build interior PDF
- Build cover PDF
- Apply safe margins and print-ready layout
- Support one-sided coloring-page layout for print products
- Store downloadable final assets

### 13.7 Payments and checkout

Priority: `P0`

- `Stripe Checkout` for one-time payments
- Separate digital and print checkout paths
- Support guest checkout
- Support promo codes later, not required for initial launch
- Turn on automatic tax
- Include shipping line item for print orders
- Default the product configuration to the 30-design offer
- Let customers toggle between `PDF` and `Print + PDF`
- Present 50 and 100 as clear upgrade options instead of equal-weight choices

### 13.8 Lulu print fulfillment

Priority: `P0`

- Call Lulu shipping options endpoint with destination and product spec
- Persist chosen shipping method
- Submit print job after successful payment and file readiness
- Store Lulu print job ID and status
- Poll or sync order status updates
- Capture shipping phone number because Lulu requires it for fulfillment

### 13.9 Notifications

Priority: `P0`

- Sample ready email
- Order confirmation email
- PDF ready email
- Print submitted/in production email
- Shipped email with tracking when available
- Failure or support-needed internal alert
- Free-sample lead sequence for non-buyers
- Buyer follow-up sequence for reorder and extra-copy opportunities

### 13.10 Customer portal

Priority: `P1`

- Magic-link access
- Order status display
- PDF redownload
- Shipping/tracking display
- Support request entry point

### 13.11 Admin tools

Priority: `P0`

- Search orders by email, order ID, Lulu ID
- View source uploads, generated pages, final assets
- Re-run page generation
- Replace selected pages
- Resubmit or cancel print jobs
- Trigger replacement workflow
- Refund annotation and audit trail

### 13.12 Lifecycle and upsell system

Priority: `P1`

- Post-sample upgrade path that defaults to the 30-design offer
- Post-PDF upsell for printed spiral copy
- Post-print upsell for extra printed copies
- Buyer follow-up offers for grandparent gift copy, sibling add-on, pet mini-book, and seasonal or holiday packs
- Non-buyer follow-up sequence that continues from the free-sample flow

## 14. Technical Architecture

### 14.1 Recommended stack

- Web app: `Next.js`
- Hosting: `Vercel`
- Database: `Postgres`
- Auth for portal/admin: magic links or passwordless email for customers; standard auth for admin
- File storage: `Google Cloud Storage`
- Background workers: `Cloud Run`
- Queueing: `Cloud Tasks` or `Pub/Sub`
- AI generation: pluggable provider adapter, defaulting to Google image generation
- Payments: `Stripe`
- Fulfillment: `Lulu Print API`
- Emails: `Resend` or `Postmark`
- Error tracking: `Sentry`
- Analytics: `PostHog` + `GA4`

### 14.2 Architecture rationale

The frontend and conversion surface benefit from a fast web stack. The generation and print pipeline needs durable background processing and reliable file hosting. Separating the synchronous web app from the async worker pipeline keeps checkout and product browsing fast while allowing long-running jobs to complete safely.

### 14.3 Core services

#### Web application

Responsibilities:

- marketing site rendering
- upload UX
- pricing and configuration
- shipping quote display
- Stripe session creation
- order portal rendering
- admin UI

#### API layer

Responsibilities:

- create draft orders
- create sample jobs
- accept uploads
- persist metadata
- start background jobs
- coordinate order state transitions

#### Worker pipeline

Responsibilities:

- photo normalization
- generation requests
- cleanup pass
- QA scoring
- PDF assembly
- Lulu submission
- email and status triggers

#### Storage

Responsibilities:

- original uploads
- normalized working files
- generated page images
- final PDFs
- temporary artifacts

### 14.4 Data model

Core entities:

- `users`
- `orders`
- `order_items`
- `uploads`
- `generation_jobs`
- `generation_pages`
- `assets`
- `shipping_quotes`
- `fulfillment_jobs`
- `email_events`
- `support_actions`

Key order attributes:

- order type: `sample`, `pdf`, `print`
- selected design count
- payment state
- production state
- shipping state
- customer contact data
- selected shipping option
- Lulu job ID

### 14.5 Order state machine

Proposed high-level states:

- `draft`
- `awaiting_payment`
- `paid`
- `preprocessing`
- `generating`
- `qa_review`
- `assembling_pdf`
- `pdf_ready`
- `awaiting_print_submission`
- `submitted_to_lulu`
- `in_production`
- `shipped`
- `delivered`
- `failed`
- `support_required`
- `refunded`

Notes:

- Digital orders can terminate at `pdf_ready`
- Print orders continue through Lulu fulfillment states
- All state transitions must be idempotent and logged

## 15. Generation and Cleanup Pipeline

### 15.1 Pipeline goals

Each page should end as:

- white background
- strong black outlines
- minimal gray noise
- enough open coloring space
- safe placement within print margins

### 15.2 Proposed pipeline stages

1. Normalize uploads
2. Create page plan
3. Generate line-art page from each selected photo
4. Run deterministic cleanup pass
5. QA score page
6. Regenerate only failures
7. Assemble final PDFs

### 15.3 Cleanup pass requirements

- grayscale normalization
- contrast boost
- denoise
- threshold to black/white or grayscale-safe output as needed
- line strengthening
- small speck removal
- trim-safe margin placement
- optional vectorization experiment for later, not required for v1

### 15.4 QA checks

- too much dark fill
- too many small artifacts
- subject too close to trim edge
- broken faces or obvious generation defects
- insufficient line clarity

### 15.5 AI model strategy

V1 should not hardcode the entire product around a single AI vendor contract in the product layer. The system should use a provider abstraction with:

- one default low-cost generation lane
- one higher-quality fallback lane for failed pages
- benchmarking harness during phase 0

Current expectation:

- default: Google image generation model optimized for price and speed
- fallback: higher-quality Google or OpenAI image generation for hard cases

The exact production model should be locked only after benchmarking representative family-photo inputs and ordering physical proofs.

## 16. Lulu Fulfillment Requirements

### 16.1 How Lulu fits into the system

Lulu is the print manufacturing and shipping backend. littlecolorbook.com remains responsible for:

- collecting the order
- charging the customer
- generating the files
- quoting shipping before purchase
- submitting valid print jobs
- surfacing status to the customer

### 16.2 Required Lulu flow

1. Call shipping options endpoint
2. Store available methods, cost, and estimated transit times
3. After payment and file readiness, submit print job
4. Persist Lulu job ID
5. Track status until shipped and delivered

### 16.3 Lulu-specific implementation constraints

- Lulu requires accessible file URLs for the interior and cover PDFs
- Lulu requires valid shipping details, including phone number
- Faster shipping does not reduce production time
- Lulu charges print cost, shipping, fulfillment fee, and applicable tax
- Lulu requires payment before printing begins; v1 should enable automatic payment for submitted API orders
- Fulfillment fee should be passed through in pricing logic
- Packing slips can be branded, but special packaging is not supported

## 17. Ecommerce and Checkout Requirements

### 17.1 V1 ecommerce recommendation

Use custom checkout creation with `Stripe Checkout`.

Rationale:

- Best fit for custom-priced, custom-configured orders
- Simpler than Shopify for async generated goods
- Easier to combine uploaded job metadata with payment metadata

### 17.2 Print checkout flow

1. Customer configures product
2. Customer enters shipping destination
3. App requests Lulu shipping options
4. Customer selects shipping option
5. App creates Stripe Checkout session with:
   - book price
   - shipping amount
   - tax handling
6. Order proceeds to production only after successful payment

### 17.3 Why not Shopify for v1

- Catalog/cart model is mismatched to generated custom orders
- Custom products require workarounds
- Checkout customization constraints are not favorable for this use case
- Third-party shipping logic introduces additional plan and integration complexity

### 17.4 When to revisit Shopify

Revisit only if one or more of these become true:

- there is a large catalog of standard products
- the business wants Shopify-native merchandising and discount tooling
- operations are mature enough that the extra platform complexity is worth it

## 18. UX and Content Requirements

### 18.1 Information architecture

Public pages:

- homepage
- free sample landing page
- pricing page
- how it works
- examples gallery
- FAQ
- gift-focused landing pages

Private/product pages:

- builder
- checkout redirect
- order confirmation
- order portal

Admin pages:

- orders
- job queue
- print jobs
- support actions
- metrics dashboard

### 18.2 UX principles

- Keep choices low
- Show before-and-after examples early
- Lead with the emotional value, not the AI mechanics
- Use upload-first flows for warm traffic and free sample flows for cold traffic
- Be explicit about timelines
- Treat the 30-design book as the default buying path
- Use the free sample as the proof mechanism instead of a complex approval workflow

### 18.3 Preview strategy

V1 preview strategy:

- free sample acts as the proof of style and quality
- paid orders do not require customer approval before production
- admin can intercept flagged print jobs if QA fails

### 18.4 Homepage and landing-page content requirements

Homepage should include:

- hero section with free-sample CTA
- trust bar
- simple 3-step how-it-works section
- before/after proof section
- featured product cards for 30, 50, and 100 design offers
- use-case section
- guarantee section
- FAQ
- final free-sample CTA

Cold-traffic landing pages should include:

- before/after proof
- one-photo upload
- email capture
- minimal distraction and no large album requirement

Sample delivery page should include:

- clear in-progress state
- child-name collection if not already captured
- immediate upgrade options while generation is running

### 18.5 Checkout and upsell UX rules

- Default selection should be the 30-design option
- Product cards should display both `PDF` and `Print + PDF` prices when relevant
- After PDF purchase, offer `Add a spiral-bound printed copy`
- After print purchase, offer `Add an extra copy for grandparents`

## 19. Privacy, Safety, and Compliance

This product handles family photos and often photos of children. Privacy requirements are therefore first-order concerns.

### 19.1 Requirements

- Clear consent language for uploaded photos
- Clear retention policy
- Ability to delete orders and source uploads on request
- Private-by-default file storage
- Signed URLs for temporary file access
- Restricted admin access to source photos
- Audit logs for manual support access

### 19.2 Abuse prevention

- Block or review explicit content
- Block unsafe or illegal imagery
- Prevent public gallery reuse of customer photos without explicit consent

### 19.3 Legal pages

- privacy policy
- terms of service
- refund and replacement policy
- shipping policy
- content guidelines

## 20. Observability and Operations

### 20.1 Monitoring

- job success/failure rate
- generation latency by SKU
- page-level QA failure rate
- PDF assembly failures
- Lulu submission failures
- email delivery failures

### 20.2 Alerts

- worker backlog above threshold
- payment succeeded but generation not started
- Lulu submission failed
- high regeneration rate on a specific prompt/model version
- spike in support-required orders

### 20.3 Auditability

- record prompt version
- record model/provider used per page
- record cleanup pipeline version
- record final assets used for each fulfilled order

## 21. Risks and Mitigations

### Risk: inconsistent output quality

Mitigation:

- benchmark before launch
- page-level QA and selective rerender
- founder review during early beta

### Risk: poor print quality

Mitigation:

- print physical proofs before launch
- lock one print spec
- maintain conservative margins and cleanup rules

### Risk: support burden on edge-case photos

Mitigation:

- set clear photo guidance
- reject clearly bad uploads early
- include limited redo policy

### Risk: shipping dissatisfaction

Mitigation:

- show separate production and transit expectations
- use live Lulu shipping quotes
- keep launch region to US only

### Risk: vendor lock-in

Mitigation:

- provider abstraction for image generation
- internal order state machine independent of vendors

### Risk: privacy concerns

Mitigation:

- private storage
- short retention defaults
- deletion tooling
- restricted admin visibility

## 22. Phased Roadmap

### Phase 0: Proof and benchmark

Objective:

- validate output quality, real cost, and print quality before full build

Deliverables:

- representative photo benchmark set
- provider/model benchmark
- cleanup pipeline prototype
- 2-3 printed physical proofs
- locked pricing assumptions

### Phase 1: MVP build

Objective:

- launch free sample, paid PDF, and paid print ordering

Scope:

- marketing site
- free sample landing page
- main product page with 30, 50, and 100 offers
- upload flow
- sample generator flow using 1 uploaded photo
- Stripe Checkout
- async generation pipeline
- PDF assembly
- Lulu submission
- email notifications
- simple admin dashboard
- basic free-sample nurture emails
- basic print and extra-copy upsell hooks

### Phase 2: Conversion optimization

Objective:

- improve funnel performance and AOV

Scope:

- one-click print upsell after PDF purchase
- extra-copy upsell
- improved examples library
- A/B test pricing and offer framing
- customer portal improvements
- full 5-email sample nurture sequence
- buyer reorder and seasonal email flows
- stronger gallery and proof assets

### Phase 3: Product expansion

Objective:

- expand offer depth without breaking the core workflow

Candidate additions:

- holiday editions
- pet books
- birthday-party packs
- hardcover gift edition
- reorder flow
- gift purchase flow

## 23. Open Questions

- What exact AI model wins the benchmark for quality-to-cost on real family photos?
- Do we want a customer-visible style selector in v1, or is one consistent house style better?
- Should the free sample be fully free, or should email capture plus watermark be mandatory?
- Should print shipping remain separate, or should we move to bundled shipping after enough order volume?
- What retention period should we set for source images and final assets?
- Do we want to allow customers to reorder from prior uploads, or require fresh uploads each time?

## 24. Launch Acceptance Criteria

The product is ready for a controlled launch when:

- physical proofs are approved
- pricing is validated against live vendor costs
- free sample flow works end-to-end
- PDF flow works end-to-end without manual intervention
- print flow works end-to-end through Lulu for test orders
- email notifications are reliable
- admin can recover from failed generation pages and failed print submissions
- legal pages and privacy controls are live

## 25. Appendix: Recommended V1 Deliverables

Product and growth:

- one homepage
- one free sample landing page
- one main product page for 30, 50, and 100 design books
- one pricing page
- one example gallery
- 20 strong before-and-after examples
- 10 short-form videos from those examples

Core app:

- upload flow
- sample generator
- PDF order flow
- print order flow
- order portal
- admin dashboard
- post-sample upgrade flow
- post-purchase upsell hooks

Integrations:

- Stripe
- Lulu
- email provider
- analytics
- error tracking

Operations:

- refund and replacement workflow
- source photo deletion workflow
- support runbook

Lifecycle:

- sample email plus nurture sequence
- buyer confirmation and reorder sequence
