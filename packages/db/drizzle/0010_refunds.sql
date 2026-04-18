-- Phase 3: refund engine.
-- Tiered refund policy per tasks/customer-accounts-spec.md §2. The refunds
-- table tracks each refund request + Stripe call + final disposition.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "refunded_cents" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "refunds" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "ticket_id" text REFERENCES "tickets"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'requested',
  "reason" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "refunded_cents" integer,
  "stripe_refund_id" text,
  "stripe_error" jsonb,
  "requested_by_email" text,
  "approved_by_email" text,
  "policy_tier" text NOT NULL,
  "notes" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "refunds_stripe_refund_unique" UNIQUE ("stripe_refund_id")
);

CREATE INDEX IF NOT EXISTS "refunds_order_idx"
  ON "refunds" ("order_id");

CREATE INDEX IF NOT EXISTS "refunds_status_idx"
  ON "refunds" ("status", "created_at" DESC)
  WHERE "status" IN ('requested', 'approved', 'processing');

CREATE INDEX IF NOT EXISTS "refunds_ticket_idx"
  ON "refunds" ("ticket_id");
