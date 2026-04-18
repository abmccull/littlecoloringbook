-- Phase 7b: Visual Semantic Auto-Tagger + Tag Performance Attribution
-- Migration 0024 — adds semantic_tags + semantic_tagged_at to creative_assets

-- ─── New columns ──────────────────────────────────────────────────────────────

ALTER TABLE "creative_assets"
  ADD COLUMN IF NOT EXISTS "semantic_tags"      jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "semantic_tagged_at" timestamptz;

-- ─── GIN index for fast @> containment queries ────────────────────────────────

CREATE INDEX IF NOT EXISTS "creative_assets_semantic_tags_gin_idx"
  ON "creative_assets" USING GIN ("semantic_tags");

-- ─── DOWN (comment only — apply manually if rollback required) ────────────────
-- DROP INDEX IF EXISTS "creative_assets_semantic_tags_gin_idx";
-- ALTER TABLE "creative_assets" DROP COLUMN IF EXISTS "semantic_tagged_at";
-- ALTER TABLE "creative_assets" DROP COLUMN IF EXISTS "semantic_tags";
