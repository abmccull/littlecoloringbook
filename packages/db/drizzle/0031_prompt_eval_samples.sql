-- Migration 0031 — prompt-eval A/B harness
--
-- Stores the output of `scripts/generate-prompt-eval.mjs`: for each source
-- photo × prompt/model variant, one row pointing at the rendered coloring
-- page in GCS. Scoring is captured in-place on the same row so we can run
-- multiple runs (different prompt revisions, model ladders) against the
-- same source pool and compare averages.
--
-- Purely additive. No FKs — the historical "old_historical" variant points
-- at pre-existing assets rows, and we don't want the eval history deleted
-- when those get cleaned up.

CREATE TABLE IF NOT EXISTS "prompt_eval_samples" (
  "id"                  text PRIMARY KEY,
  "run_id"              text NOT NULL,
  "source_upload_id"    text NOT NULL,
  "source_object_path"  text NOT NULL,
  "order_id_hint"       text,
  "variant"             text NOT NULL,
  "model"               text NOT NULL,
  "prompt_text"         text,
  "output_object_path"  text NOT NULL,
  "overall_score"       smallint,
  "score_dimensions"    jsonb,
  "notes"               text,
  "scored_at"           timestamptz,
  "scored_by"           text,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "prompt_eval_samples_run_id_idx"
  ON "prompt_eval_samples" ("run_id");

CREATE INDEX IF NOT EXISTS "prompt_eval_samples_scored_at_idx"
  ON "prompt_eval_samples" ("scored_at");

CREATE UNIQUE INDEX IF NOT EXISTS "prompt_eval_samples_run_source_variant_unique"
  ON "prompt_eval_samples" ("run_id", "source_upload_id", "variant");
