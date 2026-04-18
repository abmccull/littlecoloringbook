-- Phase 7a: Copy Element Store + Mix-Match + Performance Attribution
-- Migration 0023 — copy_elements table + element_ids column on creative_briefs

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "copy_element_kind" AS ENUM ('hook', 'body', 'cta', 'visual_style');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── copy_elements table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "copy_elements" (
  "id"                 text PRIMARY KEY,
  "kind"               copy_element_kind NOT NULL,
  "text"               text NOT NULL,
  "label"              text,
  "brand_voice_score"  numeric(5,3),
  "audience_tag"       text,
  "tags_json"          jsonb NOT NULL DEFAULT '{}',
  "usage_count"        integer NOT NULL DEFAULT 0,
  "last_used_at"       timestamptz,
  "retired_at"         timestamptz,
  "created_by"         text,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "copy_elements_kind_idx"
  ON "copy_elements" ("kind");

CREATE INDEX IF NOT EXISTS "copy_elements_kind_retired_at_idx"
  ON "copy_elements" ("kind", "retired_at");

CREATE INDEX IF NOT EXISTS "copy_elements_audience_tag_idx"
  ON "copy_elements" ("audience_tag");

-- Unique constraint: same (kind, text) should not be inserted twice.
-- The seed script uses this for idempotency checks but enforces it in application
-- code; add a partial unique index on (kind, text) for fast dedup lookups.
CREATE UNIQUE INDEX IF NOT EXISTS "copy_elements_kind_text_unique"
  ON "copy_elements" ("kind", "text");

-- ─── ADD element_ids to creative_briefs ──────────────────────────────────────
-- Shape: { hook_id?, body_id?, cta_id?, visual_style_id? }
-- NULL means the brief uses legacy inline text strings.

ALTER TABLE "creative_briefs"
  ADD COLUMN IF NOT EXISTS "element_ids" jsonb;

-- ─── DOWN (comment only — apply manually if rollback required) ────────────────
-- ALTER TABLE "creative_briefs" DROP COLUMN IF EXISTS "element_ids";
-- DROP INDEX IF EXISTS "copy_elements_kind_text_unique";
-- DROP INDEX IF EXISTS "copy_elements_audience_tag_idx";
-- DROP INDEX IF EXISTS "copy_elements_kind_retired_at_idx";
-- DROP INDEX IF EXISTS "copy_elements_kind_idx";
-- DROP TABLE IF EXISTS "copy_elements";
-- DROP TYPE IF EXISTS "copy_element_kind";
