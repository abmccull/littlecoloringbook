-- Metrics + reporting instrumentation.
-- Adds per-page Gemini cost stamping and a manual ad-spend ledger so
-- the /admin/metrics dashboard can compute CAC / margin / cost-per-sample
-- without relying on external analytics providers.

ALTER TABLE "generation_pages"
  ADD COLUMN IF NOT EXISTS "cost_cents" integer;

CREATE TABLE IF NOT EXISTS "ad_spend_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "spend_date" date NOT NULL,
  "platform" text NOT NULL,           -- 'meta' | 'google' | 'tiktok' | 'other'
  "campaign" text,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "notes" text,
  "recorded_by_email" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ad_spend_entries_date_idx"
  ON "ad_spend_entries" ("spend_date" DESC);

CREATE INDEX IF NOT EXISTS "ad_spend_entries_platform_idx"
  ON "ad_spend_entries" ("platform", "spend_date" DESC);
