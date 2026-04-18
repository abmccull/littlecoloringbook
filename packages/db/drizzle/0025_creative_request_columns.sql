-- Migration 0025 — add fulfillment-tracking columns to creative_requests
-- Owned by: creative-request-fulfillment cron (Phase 4 close-loop)
-- Parallel agents own 0023 (copy_elements) and 0024 (semantic_tags) — all are additive.

ALTER TABLE IF EXISTS "creative_requests"
  ADD COLUMN IF NOT EXISTS "result_json"     jsonb,
  ADD COLUMN IF NOT EXISTS "attempt_count"   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_error"      text,
  ADD COLUMN IF NOT EXISTS "rejected_at"     timestamptz;

-- Index: speed up the cron's pending query (ORDER BY created_at ASC, status = 'pending')
CREATE INDEX IF NOT EXISTS "creative_requests_status_created_at_idx"
  ON "creative_requests" ("status", "created_at" ASC);
