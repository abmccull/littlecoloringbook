CREATE TYPE "public"."asset_kind" AS ENUM('normalized', 'generated_page', 'preview', 'interior_pdf', 'cover_pdf', 'download_pdf');--> statement-breakpoint
CREATE TYPE "public"."delivery_mode" AS ENUM('sample', 'pdf', 'print');--> statement-breakpoint
CREATE TYPE "public"."email_event_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('draft', 'submitted', 'in_production', 'shipped', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_job_kind" AS ENUM('sample', 'full_book');--> statement-breakpoint
CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."generation_page_status" AS ENUM('queued', 'generated', 'approved', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_payment', 'paid', 'preprocessing', 'generating', 'qa_review', 'assembling_pdf', 'pdf_ready', 'awaiting_print_submission', 'submitted_to_lulu', 'in_production', 'shipped', 'delivered', 'failed', 'support_required', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('sample', 'pdf', 'print');--> statement-breakpoint
CREATE TYPE "public"."support_action_type" AS ENUM('rerender_page', 'replace_page', 'resubmit_lulu', 'mark_support_required', 'send_email');--> statement-breakpoint
CREATE TYPE "public"."upload_kind" AS ENUM('original', 'reference');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('presigned', 'uploaded', 'failed');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"kind" "asset_kind" NOT NULL,
	"object_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"page_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"template" text NOT NULL,
	"provider" text DEFAULT 'stub' NOT NULL,
	"provider_message_id" text,
	"subject" text,
	"status" "email_event_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"provider" text DEFAULT 'lulu' NOT NULL,
	"provider_job_id" text,
	"status" "fulfillment_status" DEFAULT 'draft' NOT NULL,
	"shipping_service" text,
	"tracking_number" text,
	"tracking_url" text,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"kind" "generation_job_kind" NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"target_pages" integer DEFAULT 1 NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"generation_job_id" text NOT NULL,
	"upload_id" text,
	"page_number" integer NOT NULL,
	"status" "generation_page_status" DEFAULT 'queued' NOT NULL,
	"asset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"full_name" text,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text DEFAULT 'US' NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"order_type" "order_type" NOT NULL,
	"delivery_mode" "delivery_mode" NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"selected_offer_code" text NOT NULL,
	"design_count" integer NOT NULL,
	"child_first_name" text,
	"dedication_text" text,
	"currency" text DEFAULT 'usd' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"lulu_print_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"service" text NOT NULL,
	"label" text NOT NULL,
	"shipping_cents" integer NOT NULL,
	"window" text NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL,
	"quote_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"action_type" "support_action_type" NOT NULL,
	"page_number" integer,
	"notes" text,
	"created_by" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"kind" "upload_kind" DEFAULT 'original' NOT NULL,
	"status" "upload_status" DEFAULT 'presigned' NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"object_path" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_jobs" ADD CONSTRAINT "fulfillment_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pages" ADD CONSTRAINT "generation_pages_generation_job_id_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pages" ADD CONSTRAINT "generation_pages_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pages" ADD CONSTRAINT "generation_pages_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_addresses" ADD CONSTRAINT "order_addresses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tokens" ADD CONSTRAINT "portal_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_actions" ADD CONSTRAINT "support_actions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_object_path_idx" ON "assets" USING btree ("object_path");--> statement-breakpoint
CREATE INDEX "assets_order_idx" ON "assets" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_events_order_idx" ON "email_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "fulfillment_jobs_order_idx" ON "fulfillment_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_order_idx" ON "generation_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "generation_pages_job_idx" ON "generation_pages" USING btree ("generation_job_id");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_tokens_hash_idx" ON "portal_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "portal_tokens_order_idx" ON "portal_tokens" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipping_quotes_order_idx" ON "shipping_quotes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "support_actions_order_idx" ON "support_actions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_object_path_idx" ON "uploads" USING btree ("object_path");--> statement-breakpoint
CREATE INDEX "uploads_order_idx" ON "uploads" USING btree ("order_id");