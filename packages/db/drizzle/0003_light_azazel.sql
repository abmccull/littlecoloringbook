ALTER TABLE "orders" ADD COLUMN "acquisition_path" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "entry_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm_term" text;--> statement-breakpoint
CREATE INDEX "orders_acquisition_path_idx" ON "orders" USING btree ("acquisition_path");