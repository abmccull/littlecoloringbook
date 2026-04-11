ALTER TABLE "orders" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "landing_path" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "first_touch" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_touch" jsonb;--> statement-breakpoint
CREATE INDEX "orders_visitor_idx" ON "orders" USING btree ("visitor_id");