-- Organic Social Publishing — Phase 3a
-- Tables: organic_posts (state machine), organic_post_metrics (engagement time-series)

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "organic_post_status" AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled');
CREATE TYPE "organic_post_platform" AS ENUM ('fb', 'ig', 'fb_ig');
CREATE TYPE "organic_post_format" AS ENUM ('single_image', 'carousel', 'reel', 'story');

-- ─── organic_posts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organic_posts" (
  "id"                   text PRIMARY KEY NOT NULL,
  "platform"             "organic_post_platform" NOT NULL,
  "format"               "organic_post_format" NOT NULL,
  "status"               "organic_post_status" NOT NULL DEFAULT 'draft',
  "caption"              text NOT NULL,
  "first_comment"        text,
  "image_asset_ids"      text[] NOT NULL DEFAULT '{}',
  "scheduled_at"         timestamptz,
  "publishing_attempts"  integer NOT NULL DEFAULT 0,
  "published_at"         timestamptz,
  "meta_fb_post_id"      text,
  "meta_ig_post_id"      text,
  "error_message"        text,
  "created_by"           text,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "organic_posts_status_idx"
  ON "organic_posts" ("status");
CREATE INDEX IF NOT EXISTS "organic_posts_scheduled_at_idx"
  ON "organic_posts" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "organic_posts_published_at_idx"
  ON "organic_posts" ("published_at");

-- ─── organic_post_metrics ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organic_post_metrics" (
  "id"               text PRIMARY KEY NOT NULL,
  "organic_post_id"  text NOT NULL REFERENCES "organic_posts" ("id") ON DELETE CASCADE,
  "observed_at"      timestamptz NOT NULL,
  "platform"         "organic_post_platform" NOT NULL,
  "impressions"      integer NOT NULL DEFAULT 0,
  "reach"            integer NOT NULL DEFAULT 0,
  "reactions"        integer NOT NULL DEFAULT 0,
  "comments"         integer NOT NULL DEFAULT 0,
  "shares"           integer NOT NULL DEFAULT 0,
  "clicks"           integer NOT NULL DEFAULT 0,
  "engagement_rate"  numeric(5, 4),
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "organic_post_metrics_post_observed_idx"
  ON "organic_post_metrics" ("organic_post_id", "observed_at" DESC);
