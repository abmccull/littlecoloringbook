CREATE TABLE IF NOT EXISTS "daily_metrics_rollup" (
  "day" date PRIMARY KEY,
  "revenue_cents" integer NOT NULL DEFAULT 0,
  "refunded_cents" integer NOT NULL DEFAULT 0,
  "paid_orders" integer NOT NULL DEFAULT 0,
  "pdf_orders" integer NOT NULL DEFAULT 0,
  "print_orders" integer NOT NULL DEFAULT 0,
  "samples" integer NOT NULL DEFAULT 0,
  "new_paying_customers" integer NOT NULL DEFAULT 0,
  "gemini_cost_cents" integer NOT NULL DEFAULT 0,
  "lulu_cost_cents" integer NOT NULL DEFAULT 0,
  "ad_spend_cents" integer NOT NULL DEFAULT 0,
  "recomputed_at" timestamptz NOT NULL DEFAULT now()
);
