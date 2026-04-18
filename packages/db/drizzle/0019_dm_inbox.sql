-- Phase 5 — DM Inbox (Messenger + Instagram Direct)
-- Tables: dm_threads, dm_messages
-- Enums: dm_platform, dm_thread_status, dm_message_direction

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "dm_platform" AS ENUM ('fb_messenger', 'ig_direct');
CREATE TYPE "dm_thread_status" AS ENUM ('open', 'snoozed', 'closed');
CREATE TYPE "dm_message_direction" AS ENUM ('inbound', 'outbound');

-- ─── dm_threads ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dm_threads" (
  "id"                     text PRIMARY KEY NOT NULL,
  "platform"               dm_platform NOT NULL,
  "platform_user_id"       text NOT NULL,
  "platform_user_handle"   text,
  "user_display_name"      text,
  "avatar_url"             text,
  "status"                 dm_thread_status NOT NULL DEFAULT 'open',
  "last_user_message_at"   timestamptz,
  "last_agent_message_at"  timestamptz,
  "window_expires_at"      timestamptz,
  "assigned_to"            text,
  "unread_count"           integer NOT NULL DEFAULT 0,
  "ticket_id"              text REFERENCES "tickets"("id") ON DELETE SET NULL,
  "notes"                  text,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dm_threads_platform_user_unique"
  ON "dm_threads" ("platform", "platform_user_id");

CREATE INDEX IF NOT EXISTS "dm_threads_status_idx"
  ON "dm_threads" ("status");

CREATE INDEX IF NOT EXISTS "dm_threads_window_expires_at_idx"
  ON "dm_threads" ("window_expires_at" DESC);

-- ─── dm_messages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dm_messages" (
  "id"               text PRIMARY KEY NOT NULL,
  "thread_id"        text NOT NULL REFERENCES "dm_threads"("id") ON DELETE CASCADE,
  "direction"        dm_message_direction NOT NULL,
  "meta_message_id"  text NOT NULL,
  "body"             text NOT NULL,
  "attachments_json" jsonb,
  "sent_by"          text,
  "tag"              text,
  "sent_at"          timestamptz NOT NULL,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dm_messages_meta_message_id_unique"
  ON "dm_messages" ("meta_message_id");

CREATE INDEX IF NOT EXISTS "dm_messages_thread_sent_at_idx"
  ON "dm_messages" ("thread_id", "sent_at");
