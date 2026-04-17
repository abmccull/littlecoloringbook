-- Phase: email marketing engine (sequences + broadcasts + consent)
-- Adds the persistent state we need to:
--   1. Respect customer consent for being featured in marketing content
--   2. Track which marketing contacts are synced to Resend Audiences
--   3. Record every broadcast we ship (idempotency, reporting, rollback)
--   4. Track per-customer sequence progress so we never double-send

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "feature_consent" boolean;

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "feature_consent_at" timestamptz;

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "marketing_synced_at" timestamptz;

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "resend_contact_id" text;

-- Broadcast sends — one row per scheduled/sent marketing broadcast.
-- Ties our app's notion of a send (archetype + selection + render) to
-- the Resend Broadcast we created so we can attribute clicks and
-- diagnose issues.
CREATE TABLE IF NOT EXISTS "broadcast_sends" (
  "id" text PRIMARY KEY NOT NULL,
  "archetype" text NOT NULL,            -- 'sunday_show_off' | 'thursday_gallery' | ad-hoc
  "status" text NOT NULL DEFAULT 'drafted', -- drafted | scheduled | sending | sent | failed | cancelled
  "resend_broadcast_id" text,
  "resend_audience_id" text,
  "subject" text,
  "preheader" text,
  "scheduled_for" timestamptz,
  "sent_at" timestamptz,
  "contacts_count" integer,
  "selection" jsonb,                    -- snapshot of which orders/pages were featured
  "payload" jsonb,                      -- full rendered HTML + text for audit
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "broadcast_sends_resend_id_unique" UNIQUE ("resend_broadcast_id")
);

CREATE INDEX IF NOT EXISTS "broadcast_sends_archetype_scheduled_idx"
  ON "broadcast_sends" ("archetype", "scheduled_for" DESC);

-- Email sends — one row per transactional or sequence email we actually
-- sent. Different from email_events (which is order-scoped) because
-- sequence emails can be customer-scoped, not order-scoped.
CREATE TABLE IF NOT EXISTS "email_sends" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text REFERENCES "customers"("id") ON DELETE SET NULL,
  "order_id" text REFERENCES "orders"("id") ON DELETE SET NULL,
  "sequence" text,                      -- 'welcome' | 'post_purchase' | 're_engagement' | 'abandonment' | null = one-off
  "step" integer,                       -- sequence step number; null = one-off
  "template" text NOT NULL,
  "to_email" text NOT NULL,
  "subject" text,
  "provider" text NOT NULL DEFAULT 'resend',
  "provider_message_id" text,
  "status" text NOT NULL DEFAULT 'queued', -- queued | sent | failed | skipped | bounced | complained
  "scheduled_for" timestamptz,
  "sent_at" timestamptz,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_sends_customer_sequence_idx"
  ON "email_sends" ("customer_id", "sequence", "step");

CREATE INDEX IF NOT EXISTS "email_sends_scheduled_idx"
  ON "email_sends" ("status", "scheduled_for")
  WHERE "status" IN ('queued', 'scheduled');

-- Sequence state — tracks each customer's progress through our email
-- sequences. One row per (customer, sequence) pair.
CREATE TABLE IF NOT EXISTS "email_sequence_states" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "sequence" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active', -- active | paused | completed | stopped | purchased
  "current_step" integer NOT NULL DEFAULT 0,
  "next_send_at" timestamptz,
  "enrolled_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "last_send_at" timestamptz,
  "metadata" jsonb,                     -- offer codes served, last order id, etc.
  CONSTRAINT "email_sequence_states_customer_sequence_unique"
    UNIQUE ("customer_id", "sequence")
);

CREATE INDEX IF NOT EXISTS "email_sequence_states_next_send_idx"
  ON "email_sequence_states" ("status", "next_send_at")
  WHERE "status" = 'active';
