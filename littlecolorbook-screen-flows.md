# littlecolorbook.com Screen Flows and Edge Cases

Draft v1.0  
Date: April 7, 2026

## 1. Goal

This document maps the customer and admin surfaces screen by screen for v1. It defines the purpose of each screen, the required states, validations, and the edge cases that must be handled before launch.

## 2. Global UX Rules

- The `30-design` offer is the default paid path
- Cold traffic should enter the free-sample flow first
- Print should always be framed as `Print + PDF`
- Every long-running step needs an expectation message
- Every failure state needs a recovery path
- The product should feel guided, not open-ended

## 3. Public Customer Flows

## 3.1 Homepage: `/`

Goal:

- convert traffic into free-sample starts

Required sections:

- hero with primary CTA
- trust bar
- before/after proof section
- simple 3-step how-it-works
- featured product cards for `30`, `50`, and `100`
- use cases
- guarantee section
- FAQ
- final CTA

Primary CTA:

- `Get Your Free Sample Page`

Secondary CTA:

- `See Example Books`

States:

- default load
- image-loading fallback state
- mobile stacked layout

Edge cases:

- proof assets fail to load
- CTA buttons render before tracking is ready
- mobile layout causes proof cards to overflow

Tracked events:

- `homepage_viewed`
- `homepage_primary_cta_clicked`
- `homepage_secondary_cta_clicked`

## 3.2 Free Sample Landing Page: `/sample`

Goal:

- collect one photo and an email with minimal friction

Required UI:

- headline and short supporting copy
- one-photo upload area
- email field
- optional child-name field
- proof examples
- submit CTA

Validations:

- file type supported
- file size under limit
- email valid

States:

- empty
- file selected
- uploading
- ready to submit
- submission failed

Edge cases:

- unsupported file type
- upload interrupted
- HEIC not supported in browser path
- email field invalid on submit

Tracked events:

- `sample_started`
- `sample_photo_selected`
- `sample_submitted`

## 3.3 Sample Processing Page: `/sample/processing`

Goal:

- keep the user engaged while the sample is being generated

Required UI:

- progress or waiting state
- expected timing copy
- child-name field if not already collected
- upgrade teaser cards

States:

- processing
- delayed
- ready
- failed

Edge cases:

- job runs longer than expected
- user refreshes during processing
- sample generation fails and auto-retry starts

Tracked events:

- `sample_processing_viewed`
- `sample_name_added`
- `sample_upgrade_teaser_clicked`

## 3.4 Sample Ready Page: `/sample/:token`

Goal:

- show the finished sample and convert to a paid order

Required UI:

- sample preview image
- default `30-design` offer
- `50` and `100` upsell cards
- `PDF` vs `Print + PDF` selector
- guarantee copy
- CTA to continue

States:

- ready
- token invalid
- preview missing
- already converted

Edge cases:

- token expired or invalid
- sample exists but preview image URL fails
- user returns after already placing an order

Tracked events:

- `sample_ready_viewed`
- `sample_upgraded`
- `sample_upgrade_declined`

## 3.5 Product Builder: `/create`

Goal:

- configure a paid order with the least number of decisions

Required UI:

- offer selection with `30` preselected
- `50` and `100` as upgrade options
- `PDF` and `Print + PDF` toggle
- child first name field
- optional dedication field
- continue CTA

Validations:

- design count selected
- required personalization fields present

States:

- 30 selected by default
- 50 selected
- 100 selected
- PDF selected
- Print selected

Edge cases:

- customer changes offer after uploading photos
- customer changes delivery mode after getting to shipping
- stale local state after refresh

Tracked events:

- `paid_order_started`
- `offer_changed`
- `delivery_mode_changed`

## 3.6 Album Upload Screen: `/create/uploads`

Goal:

- collect and validate the uploaded photo set

Required UI:

- multi-file upload
- thumbnails
- upload progress
- warnings for low-quality or duplicate photos
- continue CTA

Validations:

- minimum photo count for paid order
- each file type supported
- files stored successfully before continue

States:

- empty
- uploading
- validating
- warnings shown
- ready to continue

Edge cases:

- duplicate images
- too many blurry images
- partial upload success
- upload retry after network loss

Tracked events:

- `album_upload_started`
- `album_upload_completed`
- `upload_warning_shown`

## 3.7 Shipping Screen for Print Orders: `/create/shipping`

Goal:

- collect destination and return live Lulu shipping options

Required UI:

- shipping address form
- phone field
- quote button or auto-quote action
- shipping option cards
- continue to checkout CTA

Validations:

- US address only for v1
- phone required
- postal code valid

States:

- empty form
- quoting
- quotes loaded
- invalid address
- no quotes returned

Edge cases:

- Lulu quote API timeout
- address edited after quote is returned
- quote expires before checkout

Tracked events:

- `shipping_quote_requested`
- `shipping_quote_viewed`
- `shipping_option_selected`

## 3.8 Stripe Checkout Handoff

Goal:

- redirect into Stripe Checkout with correct order total and metadata

Required UI:

- loading state while session is created
- error fallback state if session creation fails

Edge cases:

- session creation fails
- selected quote expired
- price mismatch between draft order and checkout session
- customer cancels checkout and returns

Tracked events:

- `checkout_started`
- `checkout_session_failed`

## 3.9 Order Confirmation Page: `/order/confirmation`

Goal:

- confirm purchase and set clear expectations

Required UI:

- order summary
- timing expectations by order type
- next-step explanation
- portal access message

States:

- PDF order confirmed
- print order confirmed
- payment pending reconciliation

Edge cases:

- page loads before Stripe webhook reconciliation
- user refreshes repeatedly
- order exists but portal token email has not sent yet

Tracked events:

- `checkout_completed`
- `confirmation_viewed`

## 3.10 Customer Portal: `/order/:token`

Goal:

- give the customer a single place to check status and retrieve assets

Required UI:

- current order state
- PDF download when ready
- print production and shipment state
- tracking link when available
- support request entry point

States:

- paid but not started
- generating
- pdf ready
- submitted to Lulu
- in production
- shipped
- delivered
- failed or support required

Edge cases:

- invalid or expired token
- PDF asset missing even though state says ready
- tracking not yet available from provider

Tracked events:

- `portal_viewed`
- `pdf_download_clicked`
- `support_request_started`

## 4. Upsell and Lifecycle Surfaces

## 4.1 Post-Sample Upgrade Surface

Goal:

- convert sample users into buyers

Required UI:

- `30-design` offer as default
- `50` and `100` upgrade options
- `PDF` vs `Print + PDF` selector

Tracked events:

- `sample_upgrade_viewed`
- `sample_upgrade_accepted`

## 4.2 Post-PDF Upsell Surface

Goal:

- convert digital buyers into print buyers

Required UI:

- `Add a spiral-bound printed copy`
- same design count as original PDF purchase
- clear print timing and shipping note

Edge cases:

- shipping quote must be recollected
- offer no longer valid or price changed

Tracked events:

- `print_upsell_viewed`
- `print_upsell_accepted`

## 4.3 Post-Print Upsell Surface

Goal:

- sell extra copies and gift copies

Required UI:

- `Add an extra copy for grandparents`
- extra-copy pricing
- optional seasonal or sibling add-on messaging

Tracked events:

- `extra_copy_upsell_viewed`
- `extra_copy_upsell_accepted`

## 5. Admin Flows

## 5.1 Admin Order Queue

Goal:

- triage active, failed, and support-required orders quickly

Required UI:

- filters by status
- search by email, order ID, and Lulu ID
- queue emphasis on failed and support-required orders

Edge cases:

- stale provider state
- queue pagination under heavy load

Tracked events:

- `admin_order_queue_viewed`
- `admin_filter_changed`

## 5.2 Admin Order Detail

Goal:

- recover failed jobs and handle replacements without direct DB access

Required UI:

- source uploads
- generated page thumbnails
- QA flags
- final assets
- rerender page action
- replace page action
- Lulu resubmit action
- refund and replacement notes

Edge cases:

- rerendered page also fails QA
- print job already submitted but replacement needed
- support action taken while worker is still running

Tracked events:

- `admin_order_opened`
- `admin_page_rerendered`
- `admin_page_replaced`
- `admin_lulu_resubmitted`

## 6. Error-State Requirements

Every customer-facing error state should include:

- short plain-language explanation
- next recommended action
- non-destructive retry path when possible
- support contact entry point if automated recovery fails

Examples:

- upload failed: retry upload
- shipping quote failed: retry quote or edit address
- checkout failed: retry checkout session
- generation delayed: keep portal updated and send email
- print submission failed: move to support-required and notify internal ops
