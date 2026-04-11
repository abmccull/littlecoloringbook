# Little Color Book Buyer Journey Measurement Plan

Date: `2026-04-10`  
Status: `implemented v1`

## Goal

Turn the buyer journey hypothesis into something we can actually validate.

The job of this plan is to answer:

1. does the funnel move buyers through the intended belief sequence?
2. where are people dropping before the next belief forms?
3. which steps correlate with higher AOV, print take-rate, bundle take-rate, and activation speed?

## Two Allowed Funnel Paths

Little Color Book should intentionally support two different customer paths:

### 1. Default path: sample first

This is still the main cold-traffic path:

`proof -> free sample -> personalized win -> full-book builder -> upload -> checkout -> activation`

### 2. Fast path: direct buy

This is for:

- returning customers
- warm traffic that already understands the product
- buyers who already know they want the full book

That path is:

`proof -> builder -> upload -> checkout -> activation`

The sample-first path should remain the default for cold traffic, but the direct-buy path should stay visible and measurable so high-intent buyers are not forced through unnecessary friction.

## Primary Tracking Model

Use one normalized event as the main reporting layer:

- `buyer_journey_stage_reached`

This event now sits on top of the existing product analytics events. The older events still matter for debugging and detailed analysis, but `buyer_journey_stage_reached` is the clean reporting layer for funnel validation.

### Standard Properties

Every `buyer_journey_stage_reached` event should include some combination of:

- `stage`
- `stageOrder`
- `stageLabel`
- `journeyPhase`
- `expectedBelief`
- `surface`
- `orderId`
- `selectedOffer`
- `deliveryMode`
- `designCount`
- `bundleSelection`
- `quantity`
- `uploadCount`
- `source`

Not every property applies to every stage.

## Stage Map

| order | stage | phase | belief we are trying to create | current trigger |
| --- | --- | --- | --- | --- |
| 1 | `proof_viewed` | awareness | `I see what this is.` | Proof module visible on homepage; supporting proof visible on sample page |
| 2 | `free_sample_started` | consideration | `Trying one photo feels easy enough to start.` | Free sample draft successfully created |
| 3 | `sample_photo_uploaded` | consideration | `This is now my photo, not just a demo.` | First sample photo is attached to the sample order |
| 4 | `sample_ready_viewed` | consideration | `I can picture my kid using this.` | Personalized sample-ready page loads |
| 5 | `builder_started` | decision | `I am ready to turn this into the full book.` | Full-book builder page viewed |
| 6 | `offer_selected` | decision | `I know which size/version fits us.` | Builder page-count offer selected |
| 7 | `bundle_selected` | decision | `This could also work for siblings, grandparents, or gifts.` | Print bundle selected |
| 8 | `order_draft_created` | decision | `The real book is started.` | Builder saved and moved to uploads |
| 9 | `full_upload_completed` | conversion | `The book has everything it needs to get made.` | Required photo count reached on uploads step |
| 10 | `shipping_started` | conversion | `The printed version is moving toward delivery.` | Shipping step viewed for print orders |
| 11 | `checkout_started` | conversion | `I am finishing the purchase now.` | Checkout session opened |
| 12 | `purchase_confirmed` | activation | `I already have something real in motion.` | Order confirmation page viewed |
| 13 | `pdf_accessed` | activation | `I got a usable win from this order quickly.` | Order portal PDF download clicked |
| 14 | `post_purchase_upsell_clicked` | expansion | `I want more value from the same book.` | Add spiral / extra-copy upsell clicked from order portal |

## Existing Supporting Events Still Worth Keeping

These are still useful and should remain:

- `home_sample_cta_clicked`
- `home_primary_offer_clicked`
- `sample_entry_viewed`
- `sample_draft_created`
- `sample_draft_failed`
- `sample_processing_viewed`
- `sample_generation_started`
- `sample_ready_viewed`
- `builder_viewed`
- `builder_mode_selected`
- `builder_offer_selected`
- `builder_bundle_selected`
- `builder_cover_style_selected`
- `order_draft_created`
- `upload_batch_started`
- `upload_file_completed`
- `upload_batch_completed`
- `shipping_quote_requested`
- `shipping_quote_received`
- `checkout_started`
- `order_confirmation_viewed`
- `order_portal_viewed`
- `order_pdf_download_clicked`
- `spiral_upgrade_clicked`
- `extra_copy_upsell_clicked`

The difference is simple:

- use `buyer_journey_stage_reached` to validate the funnel
- use the supporting events to diagnose why a stage did or did not happen

## Core Funnel Questions To Answer

### 1. Does the intended stage order actually happen?

For the ideal path, measure the share of buyers who move through this sequence in order:

1. `proof_viewed`
2. `free_sample_started`
3. `sample_photo_uploaded`
4. `sample_ready_viewed`
5. `builder_started`
6. `offer_selected`
7. `order_draft_created`
8. `full_upload_completed`
9. `checkout_started`
10. `purchase_confirmed`

For direct-buy traffic, also measure the fast path separately:

1. `proof_viewed`
2. `builder_started`
3. `offer_selected`
4. `order_draft_created`
5. `full_upload_completed`
6. `checkout_started`
7. `purchase_confirmed`

Print buyers should also show:

- `shipping_started`

Higher-value print buyers should often show:

- `bundle_selected`

Activated buyers should later show:

- `pdf_accessed`

Expansion behavior should show:

- `post_purchase_upsell_clicked`

### 2. Do sample completers buy bigger books?

Measure:

- `% of sample-ready visitors who start builder`
- `% of sample-ready visitors who choose 50 or 100`
- `% of sample-ready visitors who choose print`
- `% of sample-ready visitors who complete purchase`

### 3. Does the funnel bias toward higher-value buyers?

Measure:

- `100-page take rate`
- `50-page take rate`
- `print take rate`
- `bundle attach rate on print orders`
- `post-purchase upsell click rate`

### 4. What is the real activation milestone?

Test these windows:

- sample started in the same session
- sample photo uploaded within `10 minutes` of sample start
- full uploads completed within `24 hours` of builder save
- purchase confirmed within `24 hours` of full upload completion
- PDF accessed within `72 hours` of purchase confirmation

The one that correlates best with upsells, referrals, or repeat purchases should become the operational activation KPI.

## Recommended Dashboards

### Journey Compliance Dashboard

Track:

- stage reach counts
- stage-to-stage conversion rates
- median time between stages
- ordered-stage compliance for purchasers

### Offer Mix Dashboard

Track:

- `30 / 50 / 100` selection share
- PDF vs print mix
- bundle mix on print path
- sample-ready to offer-selected conversion by offer size

### Activation Dashboard

Track:

- purchase confirmed to PDF accessed
- purchase confirmed to first order portal visit
- purchase confirmed to Lulu submission for print
- full upload completed to checkout started

## Current Funnel Validation

This is the current buyer-journey validation based on the implemented pages and funnel structure.

### 1. Proof first

Status: `partial pass`

What is good:

- the homepage clearly leads with visual proof before heavy explanation
- the homepage shows photo -> coloring page -> book progression before the main offer ladder
- the homepage now emits a dedicated `proof_viewed` stage when the proof module is actually visible

What is still weak:

- the direct `/sample` page still asks for email before showing its strongest product proof
- that means cold traffic sent straight to the sample page is not being forced through proof as cleanly as the homepage path
- the direct-buy fast path now exists intentionally, which is good for warm and returning buyers, but it means reporting needs to segment `sample-first` vs `direct-buy` instead of treating one path as universally correct

Conclusion:

- homepage path follows the intended journey well
- direct-to-sample path only partially does

### 2. Free sample second

Status: `pass`

What is good:

- the sample remains the primary low-friction action from the homepage
- the app now tracks `free_sample_started` only after the draft is actually created
- the app tracks when the sample photo is actually uploaded, not just when the sample page is viewed

Conclusion:

- the free sample is a real commitment step, not just a lead form

### 3. Personal win before full-book decision

Status: `pass`

What is good:

- the sample-ready page is clearly the handoff from curiosity to conviction
- the buyer sees their own personalized sample before being asked to choose the full book
- the app now tracks `sample_ready_viewed` as the critical personalized-proof stage

Conclusion:

- this part of the engineered journey is working the way it should

### 4. Full-book decision after the sample

Status: `pass`

What is good:

- the sample-ready page sends buyers into the full-book builder after the personalized preview
- the builder uses a good / better / best ladder instead of a flat table
- `offer_selected` is now standardized in the measurement layer

Conclusion:

- the funnel structurally follows the right sequence here

### 5. Bundle / extra-copy logic after the main decision

Status: `mostly pass`

What is good:

- print buyers see the multi-copy step only after choosing print and page count
- post-purchase extra-copy / spiral-book expansion is available from the order portal
- both bundle selection and post-purchase upsell clicks are now measurable in the buyer-journey stream

What is still weak:

- PDF buyers do not see much bundle framing until later in the journey
- the business intent is present, but not yet pushed as strongly across every path

Conclusion:

- the print path follows the intended logic well
- the PDF path still underuses the gifting / expansion angle until later

### 6. Fast activation after purchase

Status: `partial pass`

What is good:

- the order confirmation page exists and is instrumented as `purchase_confirmed`
- the order portal now tracks `pdf_accessed`
- print and PDF flows both have observable post-purchase status surfaces

What is still weak:

- the strongest activation event is still a hypothesis
- we do not yet track email opens/clicks for delivery notifications
- for print, the first emotional win may be order confirmation or PDF access before the physical book arrives, and we still need data to learn which matters more

Conclusion:

- the instrumentation is now good enough to discover the real activation metric
- the funnel can be measured, but activation is not yet empirically proven

## Overall Validation Summary

Right now the funnel is structurally aligned with the intended buyer journey in the middle and lower funnel:

- sample -> personalized proof -> builder -> upload -> checkout -> confirmation

The main strategic gap is still the top of the direct sample path:

- homepage visitors see proof first
- direct sample visitors can still start the sample before seeing enough product proof

If the goal is to force the journey more aggressively, the next design iteration should focus on moving transformation proof higher on the `/sample` page so that cold visitors who land there still experience proof before the email/form step.

The fast-path change does not break the buyer-journey model. It just means the model now has:

- a default `sample-first` journey for cold traffic
- an intentional `direct-buy` journey for already-convinced traffic

## Next Measurement Improvements

1. Build PostHog funnels using `buyer_journey_stage_reached`.
2. Add source attribution properties for paid social, organic, and returning-visitor traffic.
3. Add transactional email click tracking so PDF access and order re-entry can be measured from inbox behavior too.
4. After `20-30` real buyers, compare the highest-value customers against the low-value buyers to see which stage sequence actually predicts AOV and upsell behavior.
