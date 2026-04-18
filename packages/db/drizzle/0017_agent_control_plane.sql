-- Phase 4 — AI Agent Control Plane
-- Tables: agent_proposals, agent_journal, agent_baselines, creative_requests

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "agent_proposal_kind" AS ENUM (
  'pause_ad',
  'scale_budget',
  'duplicate_to_scaling_campaign',
  'request_creative',
  'update_targeting',
  'update_audience',
  'report_insight',
  'flag_risk'
);

CREATE TYPE "agent_proposal_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed',
  'expired'
);

CREATE TYPE "agent_journal_entry_kind" AS ENUM (
  'proposal_created',
  'proposal_executed',
  'proposal_rejected',
  'outcome_observed_24h',
  'outcome_observed_72h',
  'risk_flagged',
  'insight_recorded',
  'system_note'
);

-- ─── agent_proposals ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_proposals" (
  "id"                        text PRIMARY KEY NOT NULL,
  "kind"                      agent_proposal_kind NOT NULL,
  "status"                    agent_proposal_status NOT NULL DEFAULT 'pending',
  "payload_json"              jsonb NOT NULL,
  "rationale"                 text,
  "target_entity_type"        text,
  "target_meta_id"            text,
  "auto_approved"             boolean NOT NULL DEFAULT false,
  "approval_required_reason"  text,
  "created_by"                text NOT NULL,
  "reviewed_by"               text,
  "reviewed_at"               timestamptz,
  "executed_at"               timestamptz,
  "execution_result_json"     jsonb,
  "error_message"             text,
  "expires_at"                timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  "created_at"                timestamptz NOT NULL DEFAULT now(),
  "updated_at"                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_proposals_status_idx"
  ON "agent_proposals" ("status");
CREATE INDEX IF NOT EXISTS "agent_proposals_kind_idx"
  ON "agent_proposals" ("kind");
CREATE INDEX IF NOT EXISTS "agent_proposals_target_meta_id_idx"
  ON "agent_proposals" ("target_meta_id");
CREATE INDEX IF NOT EXISTS "agent_proposals_created_at_idx"
  ON "agent_proposals" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "agent_proposals_expires_at_idx"
  ON "agent_proposals" ("expires_at");

-- ─── agent_journal ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_journal" (
  "id"                        text PRIMARY KEY NOT NULL,
  "kind"                      agent_journal_entry_kind NOT NULL,
  "related_proposal_id"       text REFERENCES "agent_proposals"("id") ON DELETE SET NULL,
  "target_entity_type"        text,
  "target_meta_id"            text,
  "note"                      text NOT NULL,
  "metrics_snapshot_json"     jsonb,
  "delta_from_baseline_json"  jsonb,
  "created_by"                text NOT NULL,
  "created_at"                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_journal_related_proposal_idx"
  ON "agent_journal" ("related_proposal_id");
CREATE INDEX IF NOT EXISTS "agent_journal_kind_idx"
  ON "agent_journal" ("kind");
CREATE INDEX IF NOT EXISTS "agent_journal_created_at_idx"
  ON "agent_journal" ("created_at" DESC);

-- ─── agent_baselines ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_baselines" (
  "id"                  text PRIMARY KEY NOT NULL,
  "proposal_id"         text NOT NULL UNIQUE REFERENCES "agent_proposals"("id") ON DELETE CASCADE,
  "captured_at"         timestamptz NOT NULL DEFAULT now(),
  "target_meta_id"      text NOT NULL,
  "target_entity_type"  text NOT NULL,
  "metrics_json"        jsonb NOT NULL
);

-- ─── creative_requests ────────────────────────────────────────────────────────

CREATE TYPE "creative_request_status" AS ENUM (
  'pending',
  'fulfilled',
  'rejected'
);

CREATE TABLE IF NOT EXISTS "creative_requests" (
  "id"            text PRIMARY KEY NOT NULL,
  "brief_json"    jsonb NOT NULL,
  "status"        creative_request_status NOT NULL DEFAULT 'pending',
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "fulfilled_at"  timestamptz
);
