ALTER TABLE "orders" ADD COLUMN "cover_style" text DEFAULT 'storybook' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "copy_names" jsonb;