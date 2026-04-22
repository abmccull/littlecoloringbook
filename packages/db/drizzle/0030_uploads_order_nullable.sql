-- Migration 0030 — allow uploads to be detached from their original order
-- so source photos can be preserved as standalone creative assets after a
-- customer-data wipe. Nullable parallels the existing assets.order_id shape.

ALTER TABLE "uploads" ALTER COLUMN "order_id" DROP NOT NULL;
