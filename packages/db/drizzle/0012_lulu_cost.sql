ALTER TABLE "fulfillment_jobs"
  ADD COLUMN IF NOT EXISTS "cost_cents" integer;
