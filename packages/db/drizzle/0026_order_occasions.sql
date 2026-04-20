-- Migration 0026 - persist order-level occasion selections from the builder flow

ALTER TABLE IF EXISTS "orders"
  ADD COLUMN IF NOT EXISTS "occasion" text,
  ADD COLUMN IF NOT EXISTS "occasion_context" jsonb;
