-- Migration 0027 — per-order feature-reuse consent for the creative library.
-- Captured at sample-submission time (and optionally re-confirmed on the
-- post-purchase consent form). The ingest-consented-samples cron watches
-- this flag to move approved pairs into the creative library.

ALTER TABLE IF EXISTS "orders"
  ADD COLUMN IF NOT EXISTS "feature_consent" boolean,
  ADD COLUMN IF NOT EXISTS "feature_consent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "feature_ingested_at" timestamptz;

-- Partial index: only orders awaiting ingestion. Small + hot.
CREATE INDEX IF NOT EXISTS "orders_feature_consent_idx"
  ON "orders" ("feature_consent")
  WHERE "feature_consent" = true AND "feature_ingested_at" IS NULL;
