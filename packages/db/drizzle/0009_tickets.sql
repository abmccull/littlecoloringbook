-- Phase 2: customer ticket system.
-- Attachments are deferred to v2 (would require ticket_attachments
-- table + scoped presign flow). For v1, customers describe issues in
-- text; replies are plain text with light Markdown allowed.

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "order_id" text REFERENCES "orders"("id") ON DELETE SET NULL,
  "category" text NOT NULL,              -- refund_request | print_quality | shipping_damage | shipping_delay | wrong_item | page_rerender | account_help | other
  "status" text NOT NULL DEFAULT 'open', -- open | awaiting_customer | in_progress | resolved | closed
  "priority" text NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  "subject" text NOT NULL,
  "summary" text,
  "assigned_admin_email" text,
  "first_response_due_at" timestamptz,
  "first_responded_at" timestamptz,
  "resolved_at" timestamptz,
  "closed_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tickets_customer_idx"
  ON "tickets" ("customer_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "tickets_order_idx"
  ON "tickets" ("order_id");

CREATE INDEX IF NOT EXISTS "tickets_open_idx"
  ON "tickets" ("status", "first_response_due_at")
  WHERE "status" IN ('open', 'awaiting_customer', 'in_progress');

CREATE TABLE IF NOT EXISTS "ticket_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "ticket_id" text NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "author" text NOT NULL,                -- customer | admin | system
  "author_email" text,
  "body" text NOT NULL,
  "internal" boolean NOT NULL DEFAULT false,
  "attachments" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_idx"
  ON "ticket_messages" ("ticket_id", "created_at");
