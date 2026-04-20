-- Migration 0028 — Postgres-backed queue for internal jobs.
--
-- Replaces BullMQ + Redis for the same set of job kinds the queue
-- package handled (process-sample, process-paid-order, submit-lulu,
-- sync-lulu-status, process-capi-event). Enqueue becomes an INSERT;
-- the worker polls with SELECT ... FOR UPDATE SKIP LOCKED.
--
-- See tasks/postgres-queue-migration.md for the cutover runbook.

DO $$ BEGIN
  CREATE TYPE processing_job_kind AS ENUM (
    'process-sample',
    'process-paid-order',
    'submit-lulu',
    'sync-lulu-status',
    'process-capi-event'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE processing_job_status AS ENUM (
    'pending',
    'claimed',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "processing_jobs" (
  "id" text PRIMARY KEY,
  "kind" processing_job_kind NOT NULL,
  "payload" jsonb NOT NULL,
  "status" processing_job_status NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "scheduled_at" timestamptz NOT NULL DEFAULT now(),
  "claimed_at" timestamptz,
  "claimed_by" text,
  "completed_at" timestamptz,
  "failed_at" timestamptz,
  "last_error" text,
  "job_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Unique dedup key — prevents duplicate enqueues of the same logical
-- job (e.g. two webhooks both trying to enqueue `capi_purchase_<orderId>`).
CREATE UNIQUE INDEX IF NOT EXISTS "processing_jobs_job_key_idx"
  ON "processing_jobs" ("job_key")
  WHERE "job_key" IS NOT NULL;

-- Hot pickup path — partial index keeps it small + fast. Worker
-- queries: WHERE status='pending' AND scheduled_at <= now() ORDER BY
-- scheduled_at LIMIT N FOR UPDATE SKIP LOCKED.
CREATE INDEX IF NOT EXISTS "processing_jobs_pickup_idx"
  ON "processing_jobs" ("kind", "scheduled_at")
  WHERE "status" = 'pending';

-- Stuck-job recovery query — finds claimed jobs older than the
-- timeout. Worker self-heals every poll cycle.
CREATE INDEX IF NOT EXISTS "processing_jobs_claimed_at_idx"
  ON "processing_jobs" ("claimed_at")
  WHERE "status" = 'claimed';
