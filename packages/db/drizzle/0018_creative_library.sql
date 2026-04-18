-- Phase 2a — Creative Library
-- Tables: creative_briefs, creative_assets

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "creative_brief_kind" AS ENUM (
  'static_image',
  'carousel_image',
  'stop_motion_reveal',
  'ugc_narrated'
);

CREATE TYPE "creative_asset_source" AS ENUM (
  'pipeline_test_batch',
  'agent_generated',
  'customer_sample',
  'stock',
  'manual_upload'
);

CREATE TYPE "creative_asset_kind" AS ENUM (
  'hero_image',
  'aspect_1x1',
  'aspect_4x5',
  'aspect_9x16',
  'aspect_16x9',
  'video',
  'voiceover',
  'composite'
);

CREATE TYPE "creative_asset_compliance_status" AS ENUM (
  'pending',
  'passed',
  'warned',
  'rejected'
);

-- ─── creative_briefs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "creative_briefs" (
  "id"                  text PRIMARY KEY NOT NULL,
  "kind"                creative_brief_kind NOT NULL,
  "concept"             text NOT NULL,
  "format"              text NOT NULL,
  "hook"                text NOT NULL,
  "body"                text NOT NULL,
  "cta"                 text NOT NULL,
  "persona"             text,
  "occasion"            text,
  "offer_code"          text,
  "visual_prompt"       text NOT NULL,
  "voice_family"        text,
  "brief_version"       text NOT NULL DEFAULT '2026-04-a',
  "deterministic_seed"  text,
  "created_by"          text,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

-- ─── creative_assets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "creative_assets" (
  "id"                      text PRIMARY KEY NOT NULL,
  "brief_id"                text REFERENCES "creative_briefs"("id") ON DELETE SET NULL,
  "source"                  creative_asset_source NOT NULL,
  "kind"                    creative_asset_kind NOT NULL,
  "parent_asset_id"         text REFERENCES "creative_assets"("id") ON DELETE CASCADE,
  "gcs_bucket"              text NOT NULL,
  "gcs_object"              text NOT NULL,
  "mime_type"               text NOT NULL,
  "width_px"                integer,
  "height_px"               integer,
  "duration_seconds"        numeric(6, 2),
  "tags_json"               jsonb NOT NULL DEFAULT '{}',
  "compliance_status"       creative_asset_compliance_status NOT NULL DEFAULT 'pending',
  "compliance_checked_at"   timestamptz,
  "compliance_report_json"  jsonb,
  "consent_source"          text,
  "consent_proof"           text,
  "created_by"              text,
  "created_at"              timestamptz NOT NULL DEFAULT now(),
  "updated_at"              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "creative_assets_source_idx"
  ON "creative_assets" ("source");

CREATE INDEX IF NOT EXISTS "creative_assets_kind_idx"
  ON "creative_assets" ("kind");

CREATE INDEX IF NOT EXISTS "creative_assets_brief_id_idx"
  ON "creative_assets" ("brief_id");

CREATE INDEX IF NOT EXISTS "creative_assets_compliance_status_idx"
  ON "creative_assets" ("compliance_status");

CREATE INDEX IF NOT EXISTS "creative_assets_parent_asset_id_idx"
  ON "creative_assets" ("parent_asset_id");

CREATE INDEX IF NOT EXISTS "creative_assets_source_kind_idx"
  ON "creative_assets" ("source", "kind");
