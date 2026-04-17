-- Phase 1 of the customer-accounts / tickets / refunds rollout.
-- This migration only introduces tables and indexes required for the
-- auto-account + dashboard slice. Tickets and refunds land in later
-- migrations (see tasks/customer-accounts-spec.md).

-- Links a Neon Auth (Stack) user id to our internal customers row.
CREATE TABLE IF NOT EXISTS "customer_user_links" (
  "id" text PRIMARY KEY NOT NULL,
  "stack_user_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "source" text NOT NULL DEFAULT 'post_purchase',
  "linked_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "customer_user_links_stack_user_id_unique" UNIQUE ("stack_user_id")
);

DO $$ BEGIN
  ALTER TABLE "customer_user_links"
    ADD CONSTRAINT "customer_user_links_customer_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "customer_user_links_customer_idx"
  ON "customer_user_links" ("customer_id");

-- Idempotency record for Stripe webhooks. Every event is inserted once;
-- duplicate deliveries short-circuit on the unique index.
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "stripe_event_id" text NOT NULL,
  "type" text NOT NULL,
  "order_id" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'received',
  "payload" jsonb,
  CONSTRAINT "stripe_webhook_events_event_id_unique" UNIQUE ("stripe_event_id")
);

DO $$ BEGIN
  ALTER TABLE "stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_order_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "stripe_webhook_events_order_idx"
  ON "stripe_webhook_events" ("order_id");

-- Enforce one-order-per-checkout-session at the database level. Fixes the
-- code-review finding that nothing prevented two orders claiming the same
-- Stripe session. Partial because draft orders haven't received a session
-- id yet.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_checkout_session_unique"
  ON "orders" ("stripe_checkout_session_id")
  WHERE "stripe_checkout_session_id" IS NOT NULL;

-- Fast lookup when reconciling Lulu status.
CREATE INDEX IF NOT EXISTS "orders_lulu_print_job_idx"
  ON "orders" ("lulu_print_job_id")
  WHERE "lulu_print_job_id" IS NOT NULL;
