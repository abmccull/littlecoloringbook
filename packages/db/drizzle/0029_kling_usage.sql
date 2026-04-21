-- Migration 0029 — Kling AI credit usage tracking.
--
-- Records every Kling job we kick off so we can enforce a monthly budget
-- cap (600 credits/mo today; configurable via env). No credit-balance
-- endpoint exists on Kling's API — this table is the source of truth for
-- month-to-date and rolling-window spend.
--
-- Rows are inserted at job submission (status='submitted', credits
-- reserved at estimated value) and updated on poll completion with the
-- actual credits_spent from the response. Failed/rejected jobs still
-- record a row so the budget reflects real cost.

DO $$ BEGIN
  CREATE TYPE kling_job_status AS ENUM (
    'submitted',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "kling_usage" (
  "id" text PRIMARY KEY,
  "provider_task_id" text,
  "brief_id" text,
  "video_asset_id" text,
  "model" text NOT NULL,
  "mode" text NOT NULL,
  "resolution" text NOT NULL,
  "aspect_ratio" text NOT NULL,
  "duration_seconds" integer NOT NULL,
  "with_audio" boolean NOT NULL DEFAULT false,
  "credits_estimated" integer NOT NULL,
  "credits_spent" integer,
  "status" kling_job_status NOT NULL DEFAULT 'submitted',
  "error_message" text,
  "prompt" text NOT NULL,
  "negative_prompt" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "kling_usage_created_idx" ON "kling_usage" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "kling_usage_status_idx" ON "kling_usage" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "kling_usage_provider_task_id_unique" ON "kling_usage" ("provider_task_id")
  WHERE "provider_task_id" IS NOT NULL;
