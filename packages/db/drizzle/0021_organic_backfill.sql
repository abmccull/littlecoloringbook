-- Phase 3b — Organic Social Backfill
-- Extends organic_posts with approval workflow + backfill tracking columns.

-- ─── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE "organic_post_approval_status" AS ENUM (
  'draft',
  'approved',
  'rejected',
  'auto_generated'
);

-- ─── Columns ──────────────────────────────────────────────────────────────────

ALTER TABLE "organic_posts"
  ADD COLUMN "approval_status"          "organic_post_approval_status" NOT NULL DEFAULT 'draft',
  ADD COLUMN "approved_at"              timestamptz,
  ADD COLUMN "approved_by"              text,
  ADD COLUMN "backfilled_at"            timestamptz,
  ADD COLUMN "source_creative_asset_id" text;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "organic_posts_approval_status_idx"
  ON "organic_posts" ("approval_status");

CREATE INDEX IF NOT EXISTS "organic_posts_backfilled_at_idx"
  ON "organic_posts" ("backfilled_at")
  WHERE "backfilled_at" IS NOT NULL;

-- ─── Down (for reference — manual rollback) ───────────────────────────────────
-- DROP INDEX IF EXISTS "organic_posts_backfilled_at_idx";
-- DROP INDEX IF EXISTS "organic_posts_approval_status_idx";
-- ALTER TABLE "organic_posts"
--   DROP COLUMN IF EXISTS "source_creative_asset_id",
--   DROP COLUMN IF EXISTS "backfilled_at",
--   DROP COLUMN IF EXISTS "approved_by",
--   DROP COLUMN IF EXISTS "approved_at",
--   DROP COLUMN IF EXISTS "approval_status";
-- DROP TYPE IF EXISTS "organic_post_approval_status";
