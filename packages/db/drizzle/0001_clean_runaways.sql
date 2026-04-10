ALTER TABLE "orders" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bundle_selection" text;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;