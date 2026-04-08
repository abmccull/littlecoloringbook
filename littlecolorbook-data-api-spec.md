# littlecolorbook.com Data Model and API Spec

Draft v1.0  
Date: April 7, 2026

## 1. Scope

This document defines the recommended v1 data model, storage layout, background job contracts, and HTTP API surface for littlecolorbook.com.

It is optimized for:

- one-time guest checkout
- async generation jobs
- PDF delivery
- Lulu print fulfillment
- admin recovery actions

## 2. Data Design Principles

- Use `UUID` primary keys everywhere
- Store external provider IDs explicitly
- Make state transitions explicit and auditable
- Design for idempotent webhooks and worker retries
- Keep final assets immutable once attached to a fulfilled order
- Keep source images private by default

## 3. Core Enums

### order_type

- `sample`
- `pdf`
- `print`

### order_status

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

### payment_status

- `not_required`
- `pending`
- `paid`
- `failed`
- `refunded`
- `partially_refunded`

### fulfillment_status

- `not_applicable`
- `quote_pending`
- `quote_ready`
- `submission_pending`
- `submitted`
- `rejected`
- `in_production`
- `shipped`
- `delivered`
- `replacement_requested`
- `replacement_submitted`

### asset_type

- `original_upload`
- `normalized_upload`
- `sample_page`
- `generated_page`
- `page_preview`
- `interior_pdf`
- `cover_pdf`
- `thumbnail`

### generation_page_status

- `pending`
- `generated`
- `qa_failed`
- `accepted`
- `rerender_requested`
- `replaced`
- `failed`

### email_type

- `sample_ready`
- `order_confirmation`
- `pdf_ready`
- `print_submitted`
- `print_shipped`
- `support_notice`
- `nurture`
- `upsell`

## 4. Recommended Tables

### customers

Purpose:

- canonical customer identity across guest and repeat orders

Key fields:

- `id UUID PK`
- `email CITEXT UNIQUE NOT NULL`
- `first_name TEXT NULL`
- `last_name TEXT NULL`
- `phone TEXT NULL`
- `marketing_opt_in BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### orders

Purpose:

- source of truth for each sample, PDF order, or print order

Key fields:

- `id UUID PK`
- `public_token TEXT UNIQUE NOT NULL`
- `customer_id UUID NULL REFERENCES customers(id)`
- `order_type order_type NOT NULL`
- `order_status order_status NOT NULL`
- `payment_status payment_status NOT NULL`
- `fulfillment_status fulfillment_status NOT NULL`
- `design_count INTEGER NOT NULL`
- `selected_offer_code TEXT NOT NULL`
- `delivery_mode TEXT NOT NULL`
- `child_first_name TEXT NULL`
- `dedication_text TEXT NULL`
- `currency TEXT NOT NULL DEFAULT 'usd'`
- `subtotal_cents INTEGER NOT NULL DEFAULT 0`
- `shipping_cents INTEGER NOT NULL DEFAULT 0`
- `tax_cents INTEGER NOT NULL DEFAULT 0`
- `discount_cents INTEGER NOT NULL DEFAULT 0`
- `total_cents INTEGER NOT NULL DEFAULT 0`
- `stripe_checkout_session_id TEXT NULL`
- `stripe_payment_intent_id TEXT NULL`
- `lulu_print_job_id TEXT NULL`
- `print_shipping_option_level TEXT NULL`
- `placed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:

- `customer_id`
- `order_type, order_status`
- `stripe_checkout_session_id`
- `lulu_print_job_id`

### order_addresses

Purpose:

- persist shipping destination for print orders

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `type TEXT NOT NULL`
- `full_name TEXT NOT NULL`
- `line1 TEXT NOT NULL`
- `line2 TEXT NULL`
- `city TEXT NOT NULL`
- `state TEXT NOT NULL`
- `postal_code TEXT NOT NULL`
- `country_code TEXT NOT NULL`
- `phone TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### uploads

Purpose:

- raw uploaded photo records tied to an order

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `asset_id UUID NULL REFERENCES assets(id)`
- `upload_index INTEGER NOT NULL`
- `original_filename TEXT NOT NULL`
- `mime_type TEXT NOT NULL`
- `byte_size BIGINT NOT NULL`
- `width INTEGER NULL`
- `height INTEGER NULL`
- `checksum_sha256 TEXT NULL`
- `status TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### upload_checks

Purpose:

- validation and moderation results per uploaded image

Key fields:

- `id UUID PK`
- `upload_id UUID NOT NULL REFERENCES uploads(id)`
- `is_blurry BOOLEAN NULL`
- `is_low_resolution BOOLEAN NULL`
- `is_duplicate BOOLEAN NULL`
- `is_disallowed BOOLEAN NULL`
- `notes JSONB NOT NULL`
- `checked_at TIMESTAMPTZ NOT NULL`

### generation_jobs

Purpose:

- parent record for a sample or full-book generation run

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `job_type TEXT NOT NULL`
- `status TEXT NOT NULL`
- `provider TEXT NOT NULL`
- `model TEXT NOT NULL`
- `fallback_provider TEXT NULL`
- `fallback_model TEXT NULL`
- `prompt_version TEXT NOT NULL`
- `cleanup_version TEXT NOT NULL`
- `requested_page_count INTEGER NOT NULL`
- `accepted_page_count INTEGER NOT NULL DEFAULT 0`
- `failed_page_count INTEGER NOT NULL DEFAULT 0`
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### generation_pages

Purpose:

- track each generated page in the book pipeline

Key fields:

- `id UUID PK`
- `generation_job_id UUID NOT NULL REFERENCES generation_jobs(id)`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `source_upload_id UUID NULL REFERENCES uploads(id)`
- `page_number INTEGER NOT NULL`
- `variant_index INTEGER NOT NULL DEFAULT 0`
- `status generation_page_status NOT NULL`
- `provider TEXT NOT NULL`
- `model TEXT NOT NULL`
- `prompt_version TEXT NOT NULL`
- `cleanup_version TEXT NOT NULL`
- `qa_score NUMERIC(5,2) NULL`
- `qa_flags JSONB NOT NULL`
- `render_attempts INTEGER NOT NULL DEFAULT 1`
- `asset_id UUID NULL REFERENCES assets(id)`
- `preview_asset_id UUID NULL REFERENCES assets(id)`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### assets

Purpose:

- canonical registry for all stored files

Key fields:

- `id UUID PK`
- `order_id UUID NULL REFERENCES orders(id)`
- `asset_type asset_type NOT NULL`
- `storage_provider TEXT NOT NULL`
- `bucket TEXT NOT NULL`
- `object_key TEXT NOT NULL`
- `mime_type TEXT NOT NULL`
- `byte_size BIGINT NOT NULL`
- `width INTEGER NULL`
- `height INTEGER NULL`
- `checksum_sha256 TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

### shipping_quotes

Purpose:

- persist live shipping quotes returned from Lulu

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `provider TEXT NOT NULL DEFAULT 'lulu'`
- `service_level TEXT NOT NULL`
- `service_name TEXT NOT NULL`
- `shipping_cents INTEGER NOT NULL`
- `currency TEXT NOT NULL`
- `min_business_days INTEGER NULL`
- `max_business_days INTEGER NULL`
- `raw_response JSONB NOT NULL`
- `expires_at TIMESTAMPTZ NULL`
- `selected BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL`

### fulfillment_jobs

Purpose:

- track Lulu submission and shipment state

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `provider TEXT NOT NULL DEFAULT 'lulu'`
- `status fulfillment_status NOT NULL`
- `provider_job_id TEXT NULL`
- `provider_reference TEXT NULL`
- `submitted_at TIMESTAMPTZ NULL`
- `accepted_at TIMESTAMPTZ NULL`
- `shipped_at TIMESTAMPTZ NULL`
- `delivered_at TIMESTAMPTZ NULL`
- `tracking_number TEXT NULL`
- `tracking_url TEXT NULL`
- `raw_status JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### email_events

Purpose:

- record transactional and lifecycle email delivery attempts

Key fields:

- `id UUID PK`
- `order_id UUID NULL REFERENCES orders(id)`
- `customer_id UUID NULL REFERENCES customers(id)`
- `email_type email_type NOT NULL`
- `provider TEXT NOT NULL`
- `provider_message_id TEXT NULL`
- `recipient_email CITEXT NOT NULL`
- `status TEXT NOT NULL`
- `template_key TEXT NOT NULL`
- `metadata JSONB NOT NULL`
- `sent_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`

### order_events

Purpose:

- append-only audit of major state changes and system actions

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `event_type TEXT NOT NULL`
- `actor_type TEXT NOT NULL`
- `actor_id TEXT NULL`
- `payload JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

### support_actions

Purpose:

- track manual interventions by admins

Key fields:

- `id UUID PK`
- `order_id UUID NOT NULL REFERENCES orders(id)`
- `action_type TEXT NOT NULL`
- `admin_user_id TEXT NOT NULL`
- `notes TEXT NULL`
- `payload JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

## 5. Storage Layout

- `orders/{order_id}/uploads/original/{upload_id}.{ext}`
- `orders/{order_id}/uploads/normalized/{upload_id}.png`
- `orders/{order_id}/samples/sample-page.png`
- `orders/{order_id}/pages/{page_number}/final.png`
- `orders/{order_id}/pages/{page_number}/preview.jpg`
- `orders/{order_id}/pdf/interior.pdf`
- `orders/{order_id}/pdf/cover.pdf`
- `orders/{order_id}/thumbs/{asset_name}.jpg`

Rules:

- original uploads are private
- final PDFs are private
- signed URLs are temporary

## 6. API Surface

### Public routes

- `POST /api/uploads/presign`
- `POST /api/uploads/complete`
- `POST /api/samples`
- `GET /api/samples/:publicToken`
- `POST /api/orders`
- `POST /api/orders/:orderId/quote-shipping`
- `POST /api/orders/:orderId/checkout`
- `GET /api/orders/:publicToken`
- `GET /api/orders/:publicToken/download`
- `POST /api/orders/:publicToken/support`

### Admin routes

- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `POST /api/admin/orders/:orderId/rerender-page`
- `POST /api/admin/orders/:orderId/replace-page`
- `POST /api/admin/orders/:orderId/resubmit-lulu`
- `POST /api/admin/orders/:orderId/refund-note`

### Webhook and internal routes

- `POST /api/webhooks/stripe`
- `POST /api/internal/jobs/process-sample`
- `POST /api/internal/jobs/process-paid-order`
- `POST /api/internal/jobs/submit-lulu`
- `POST /api/internal/jobs/sync-lulu-status`
- `POST /api/internal/jobs/send-email`

## 7. State Transitions

### Sample orders

- `draft -> generating`
- `generating -> pdf_ready`
- `generating -> failed`

### PDF orders

- `draft -> awaiting_payment`
- `awaiting_payment -> paid`
- `paid -> preprocessing`
- `preprocessing -> generating`
- `generating -> qa_review`
- `qa_review -> assembling_pdf`
- `assembling_pdf -> pdf_ready`

### Print orders

- same as PDF through `assembling_pdf`
- `assembling_pdf -> awaiting_print_submission`
- `awaiting_print_submission -> submitted_to_lulu`
- `submitted_to_lulu -> in_production`
- `in_production -> shipped`
- `shipped -> delivered`

Rules:

- every transition writes to `order_events`
- transitions are idempotent
- worker retries must be replay-safe
