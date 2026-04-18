-- Meta Growth System — Phase 1 schema
-- Tables: token store, asset graph (accounts/pages/ig/pixels),
-- ad hierarchy (campaigns/adsets/ads/creatives), CAPI event log,
-- Meta webhook event log, Meta API call audit log.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "capi_event_status" AS ENUM ('queued', 'sending', 'sent', 'failed');
CREATE TYPE "meta_webhook_status" AS ENUM ('received', 'processed', 'failed');

-- ─── Token store ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "meta_tokens" (
  "id"              text PRIMARY KEY NOT NULL,
  "label"           text NOT NULL,
  "scopes"          text[] NOT NULL DEFAULT '{}',
  "issued_at"       timestamptz NOT NULL DEFAULT now(),
  "rotated_at"      timestamptz,
  "encrypted_token" text NOT NULL DEFAULT '',
  "notes"           text,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

-- ─── Asset graph ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "meta_ad_accounts" (
  "id"              text PRIMARY KEY NOT NULL,
  "meta_id"         text NOT NULL,
  "name"            text NOT NULL,
  "currency"        text NOT NULL,
  "timezone"        text NOT NULL,
  "status"          text NOT NULL,
  "business_id"     text NOT NULL,
  "last_synced_at"  timestamptz,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_accounts_meta_id_unique"
  ON "meta_ad_accounts" ("meta_id");

CREATE TABLE IF NOT EXISTS "meta_pages" (
  "id"              text PRIMARY KEY NOT NULL,
  "meta_id"         text NOT NULL,
  "name"            text NOT NULL,
  "username"        text,
  "category_text"   text,
  "ig_user_id"      text,
  "last_synced_at"  timestamptz,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_pages_meta_id_unique"
  ON "meta_pages" ("meta_id");

CREATE TABLE IF NOT EXISTS "meta_instagram_accounts" (
  "id"                   text PRIMARY KEY NOT NULL,
  "meta_id"              text NOT NULL,
  "username"             text NOT NULL,
  "name"                 text,
  "profile_picture_url"  text,
  "linked_page_meta_id"  text,
  "last_synced_at"       timestamptz,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_instagram_accounts_meta_id_unique"
  ON "meta_instagram_accounts" ("meta_id");

CREATE TABLE IF NOT EXISTS "meta_pixels" (
  "id"                  text PRIMARY KEY NOT NULL,
  "meta_id"             text NOT NULL,
  "name"                text NOT NULL,
  "dataset_id"          text NOT NULL,
  "last_emq_score"      numeric(3, 1),
  "last_emq_checked_at" timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_pixels_meta_id_unique"
  ON "meta_pixels" ("meta_id");

-- ─── Ad hierarchy ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ad_campaigns" (
  "id"                    text PRIMARY KEY NOT NULL,
  "meta_id"               text NOT NULL,
  "name"                  text NOT NULL,
  "objective"             text NOT NULL,
  "status"                text NOT NULL,
  "special_ad_categories" text[] NOT NULL DEFAULT '{}',
  "ad_account_id"         text NOT NULL REFERENCES "meta_ad_accounts" ("id") ON DELETE CASCADE,
  "last_synced_at"        timestamptz,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_campaigns_meta_id_unique"
  ON "ad_campaigns" ("meta_id");
CREATE INDEX IF NOT EXISTS "ad_campaigns_ad_account_idx"
  ON "ad_campaigns" ("ad_account_id");

CREATE TABLE IF NOT EXISTS "ad_sets" (
  "id"                  text PRIMARY KEY NOT NULL,
  "meta_id"             text NOT NULL,
  "name"                text NOT NULL,
  "campaign_id"         text NOT NULL REFERENCES "ad_campaigns" ("id") ON DELETE CASCADE,
  "status"              text NOT NULL,
  "daily_budget_cents"  integer,
  "lifetime_budget_cents" integer,
  "optimization_goal"   text NOT NULL,
  "billing_event"       text,
  "start_time"          timestamptz,
  "end_time"            timestamptz,
  "targeting_json"      jsonb,
  "last_synced_at"      timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_sets_meta_id_unique"
  ON "ad_sets" ("meta_id");
CREATE INDEX IF NOT EXISTS "ad_sets_campaign_idx"
  ON "ad_sets" ("campaign_id");

CREATE TABLE IF NOT EXISTS "ads" (
  "id"                      text PRIMARY KEY NOT NULL,
  "meta_id"                 text NOT NULL,
  "name"                    text NOT NULL,
  "ad_set_id"               text NOT NULL REFERENCES "ad_sets" ("id") ON DELETE CASCADE,
  "status"                  text NOT NULL,
  "ad_creative_meta_id"     text,
  "last_synced_at"          timestamptz,
  "created_at"              timestamptz NOT NULL DEFAULT now(),
  "updated_at"              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ads_meta_id_unique"
  ON "ads" ("meta_id");
CREATE INDEX IF NOT EXISTS "ads_ad_set_idx"
  ON "ads" ("ad_set_id");

CREATE TABLE IF NOT EXISTS "ad_creatives" (
  "id"                           text PRIMARY KEY NOT NULL,
  "meta_id"                      text NOT NULL,
  "name"                         text,
  "object_story_id"              text,
  "brief_ref"                    text,
  "effective_instagram_media_id" text,
  "created_at"                   timestamptz NOT NULL DEFAULT now(),
  "updated_at"                   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_creatives_meta_id_unique"
  ON "ad_creatives" ("meta_id");

-- ─── CAPI event log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "capi_events" (
  "id"                     text PRIMARY KEY NOT NULL,
  "event_id"               text NOT NULL,
  "event_name"             text NOT NULL,
  "event_time"             timestamptz NOT NULL,
  "action_source"          text NOT NULL,
  "user_data_fingerprint"  text NOT NULL,
  "payload_json"           jsonb NOT NULL,
  "status"                 "capi_event_status" NOT NULL DEFAULT 'queued',
  "meta_events_received"   integer,
  "meta_trace_id"          text,
  "error_message"          text,
  "retry_count"            integer NOT NULL DEFAULT 0,
  "sent_at"                timestamptz,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "capi_events_event_id_unique"
  ON "capi_events" ("event_id");
CREATE INDEX IF NOT EXISTS "capi_events_status_idx"
  ON "capi_events" ("status");
CREATE INDEX IF NOT EXISTS "capi_events_event_name_idx"
  ON "capi_events" ("event_name");
CREATE INDEX IF NOT EXISTS "capi_events_created_at_idx"
  ON "capi_events" ("created_at" DESC);

-- ─── Meta webhook event log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "meta_webhook_events" (
  "id"               text PRIMARY KEY NOT NULL,
  "provider"         text NOT NULL DEFAULT 'meta',
  "topic"            text NOT NULL,
  "object_type"      text NOT NULL,
  "payload_json"     jsonb NOT NULL,
  "signature_header" text NOT NULL,
  "received_at"      timestamptz NOT NULL DEFAULT now(),
  "processed_at"     timestamptz,
  "status"           "meta_webhook_status" NOT NULL DEFAULT 'received',
  "error_message"    text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "meta_webhook_events_status_idx"
  ON "meta_webhook_events" ("status");
CREATE INDEX IF NOT EXISTS "meta_webhook_events_received_at_idx"
  ON "meta_webhook_events" ("received_at" DESC);

-- ─── Meta API call audit log ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "meta_api_calls" (
  "id"                  text PRIMARY KEY NOT NULL,
  "method"              text NOT NULL,
  "endpoint"            text NOT NULL,
  "payload_hash"        text,
  "response_status"     integer,
  "response_excerpt"    text,
  "buc_usage_percent"   integer,
  "duration_ms"         integer,
  "error_code"          integer,
  "error_subcode"       integer,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "meta_api_calls_created_at_idx"
  ON "meta_api_calls" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "meta_api_calls_endpoint_idx"
  ON "meta_api_calls" ("endpoint");
