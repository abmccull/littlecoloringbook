-- Phase 3d — Ad Metrics Rollup tables
-- Three daily rollup tables: ad_daily_metrics, adset_daily_metrics, campaign_daily_metrics.
-- Each has an (entity_meta_id, date) unique constraint so upserts are idempotent.

-- ─── ad_daily_metrics ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ad_daily_metrics" (
  "id"                    text PRIMARY KEY NOT NULL,
  "entity_meta_id"        text NOT NULL,
  "date"                  date NOT NULL,
  "impressions"           integer NOT NULL DEFAULT 0,
  "reach"                 integer NOT NULL DEFAULT 0,
  "frequency"             numeric(6, 3),
  "spend_cents"           integer NOT NULL DEFAULT 0,
  "clicks"                integer NOT NULL DEFAULT 0,
  "link_clicks"           integer NOT NULL DEFAULT 0,
  "landing_page_views"    integer NOT NULL DEFAULT 0,
  "adds_to_cart"          integer NOT NULL DEFAULT 0,
  "initiate_checkouts"    integer NOT NULL DEFAULT 0,
  "purchases"             integer NOT NULL DEFAULT 0,
  "revenue_cents"         integer NOT NULL DEFAULT 0,
  "ctr"                   numeric(6, 4),
  "cpm_cents"             integer,
  "cpc_cents"             integer,
  "cpa_cents"             integer,
  "roas"                  numeric(8, 4),
  "video_p25_views"       integer NOT NULL DEFAULT 0,
  "video_p50_views"       integer NOT NULL DEFAULT 0,
  "video_p75_views"       integer NOT NULL DEFAULT 0,
  "video_p100_views"      integer NOT NULL DEFAULT 0,
  "hook_rate"             numeric(6, 4),
  "last_synced_at"        timestamptz NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_daily_metrics_entity_date_unique"
  ON "ad_daily_metrics" ("entity_meta_id", "date");
CREATE INDEX IF NOT EXISTS "ad_daily_metrics_date_idx"
  ON "ad_daily_metrics" ("date");
CREATE INDEX IF NOT EXISTS "ad_daily_metrics_entity_date_desc_idx"
  ON "ad_daily_metrics" ("entity_meta_id", "date" DESC);

-- ─── adset_daily_metrics ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "adset_daily_metrics" (
  "id"                    text PRIMARY KEY NOT NULL,
  "entity_meta_id"        text NOT NULL,
  "date"                  date NOT NULL,
  "impressions"           integer NOT NULL DEFAULT 0,
  "reach"                 integer NOT NULL DEFAULT 0,
  "frequency"             numeric(6, 3),
  "spend_cents"           integer NOT NULL DEFAULT 0,
  "clicks"                integer NOT NULL DEFAULT 0,
  "link_clicks"           integer NOT NULL DEFAULT 0,
  "landing_page_views"    integer NOT NULL DEFAULT 0,
  "adds_to_cart"          integer NOT NULL DEFAULT 0,
  "initiate_checkouts"    integer NOT NULL DEFAULT 0,
  "purchases"             integer NOT NULL DEFAULT 0,
  "revenue_cents"         integer NOT NULL DEFAULT 0,
  "ctr"                   numeric(6, 4),
  "cpm_cents"             integer,
  "cpc_cents"             integer,
  "cpa_cents"             integer,
  "roas"                  numeric(8, 4),
  "video_p25_views"       integer NOT NULL DEFAULT 0,
  "video_p50_views"       integer NOT NULL DEFAULT 0,
  "video_p75_views"       integer NOT NULL DEFAULT 0,
  "video_p100_views"      integer NOT NULL DEFAULT 0,
  "hook_rate"             numeric(6, 4),
  "last_synced_at"        timestamptz NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "adset_daily_metrics_entity_date_unique"
  ON "adset_daily_metrics" ("entity_meta_id", "date");
CREATE INDEX IF NOT EXISTS "adset_daily_metrics_date_idx"
  ON "adset_daily_metrics" ("date");
CREATE INDEX IF NOT EXISTS "adset_daily_metrics_entity_date_desc_idx"
  ON "adset_daily_metrics" ("entity_meta_id", "date" DESC);

-- ─── campaign_daily_metrics ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "campaign_daily_metrics" (
  "id"                    text PRIMARY KEY NOT NULL,
  "entity_meta_id"        text NOT NULL,
  "date"                  date NOT NULL,
  "impressions"           integer NOT NULL DEFAULT 0,
  "reach"                 integer NOT NULL DEFAULT 0,
  "frequency"             numeric(6, 3),
  "spend_cents"           integer NOT NULL DEFAULT 0,
  "clicks"                integer NOT NULL DEFAULT 0,
  "link_clicks"           integer NOT NULL DEFAULT 0,
  "landing_page_views"    integer NOT NULL DEFAULT 0,
  "adds_to_cart"          integer NOT NULL DEFAULT 0,
  "initiate_checkouts"    integer NOT NULL DEFAULT 0,
  "purchases"             integer NOT NULL DEFAULT 0,
  "revenue_cents"         integer NOT NULL DEFAULT 0,
  "ctr"                   numeric(6, 4),
  "cpm_cents"             integer,
  "cpc_cents"             integer,
  "cpa_cents"             integer,
  "roas"                  numeric(8, 4),
  "video_p25_views"       integer NOT NULL DEFAULT 0,
  "video_p50_views"       integer NOT NULL DEFAULT 0,
  "video_p75_views"       integer NOT NULL DEFAULT 0,
  "video_p100_views"      integer NOT NULL DEFAULT 0,
  "hook_rate"             numeric(6, 4),
  "last_synced_at"        timestamptz NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_daily_metrics_entity_date_unique"
  ON "campaign_daily_metrics" ("entity_meta_id", "date");
CREATE INDEX IF NOT EXISTS "campaign_daily_metrics_date_idx"
  ON "campaign_daily_metrics" ("date");
CREATE INDEX IF NOT EXISTS "campaign_daily_metrics_entity_date_desc_idx"
  ON "campaign_daily_metrics" ("entity_meta_id", "date" DESC);
