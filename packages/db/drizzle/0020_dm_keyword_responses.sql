-- Phase 6 — DM Keyword Auto-Reply Engine
-- Table: dm_keyword_responses
-- Enum: keyword_response_match_kind

-- ─── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE "keyword_response_match_kind" AS ENUM ('exact', 'contains', 'prefix', 'regex');

-- ─── dm_keyword_responses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dm_keyword_responses" (
  "id"               text PRIMARY KEY NOT NULL,
  "label"            text NOT NULL,
  "match_kind"       keyword_response_match_kind NOT NULL,
  "match_pattern"    text NOT NULL,
  "response_body"    text NOT NULL,
  "platform"         dm_platform,
  "enabled"          boolean NOT NULL DEFAULT true,
  "match_count"      integer NOT NULL DEFAULT 0,
  "last_matched_at"  timestamptz,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dm_keyword_responses_enabled_idx" ON "dm_keyword_responses" ("enabled");
