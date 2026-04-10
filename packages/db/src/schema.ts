import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const orderTypeValues = ["sample", "pdf", "print"] as const;
export const deliveryModeValues = ["sample", "pdf", "print"] as const;
export const orderStatusValues = [
  "draft",
  "awaiting_payment",
  "paid",
  "preprocessing",
  "generating",
  "qa_review",
  "assembling_pdf",
  "pdf_ready",
  "awaiting_print_submission",
  "submitted_to_lulu",
  "in_production",
  "shipped",
  "delivered",
  "failed",
  "support_required",
  "refunded",
] as const;
export const uploadStatusValues = ["presigned", "uploaded", "failed"] as const;
export const uploadKindValues = ["original", "reference"] as const;
export const assetKindValues = [
  "normalized",
  "generated_page",
  "preview",
  "interior_pdf",
  "cover_pdf",
  "download_pdf",
] as const;
export const generationJobStatusValues = ["queued", "running", "completed", "failed"] as const;
export const generationJobKindValues = ["sample", "full_book"] as const;
export const generationPageStatusValues = ["queued", "generated", "approved", "failed"] as const;
export const fulfillmentStatusValues = ["draft", "submitted", "in_production", "shipped", "delivered", "failed"] as const;
export const emailEventStatusValues = ["queued", "sent", "failed", "skipped"] as const;
export const supportActionTypeValues = ["rerender_page", "replace_page", "resubmit_lulu", "mark_support_required", "send_email"] as const;

export const orderTypeEnum = pgEnum("order_type", orderTypeValues);
export const deliveryModeEnum = pgEnum("delivery_mode", deliveryModeValues);
export const orderStatusEnum = pgEnum("order_status", orderStatusValues);
export const uploadStatusEnum = pgEnum("upload_status", uploadStatusValues);
export const uploadKindEnum = pgEnum("upload_kind", uploadKindValues);
export const assetKindEnum = pgEnum("asset_kind", assetKindValues);
export const generationJobStatusEnum = pgEnum("generation_job_status", generationJobStatusValues);
export const generationJobKindEnum = pgEnum("generation_job_kind", generationJobKindValues);
export const generationPageStatusEnum = pgEnum("generation_page_status", generationPageStatusValues);
export const fulfillmentStatusEnum = pgEnum("fulfillment_status", fulfillmentStatusValues);
export const emailEventStatusEnum = pgEnum("email_event_status", emailEventStatusValues);
export const supportActionTypeEnum = pgEnum("support_action_type", supportActionTypeValues);

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    phone: text("phone"),
    firstName: text("first_name"),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("customers_email_idx").on(table.email),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderType: orderTypeEnum("order_type").notNull(),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),
    status: orderStatusEnum("status").default("draft").notNull(),
    selectedOfferCode: text("selected_offer_code").notNull(),
    designCount: integer("design_count").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    bundleSelection: text("bundle_selection"),
    coverStyle: text("cover_style").default("storybook").notNull(),
    copyNames: jsonb("copy_names").$type<Array<string | null> | null>(),
    childFirstName: text("child_first_name"),
    dedicationText: text("dedication_text"),
    currency: text("currency").default("usd").notNull(),
    subtotalCents: integer("subtotal_cents").default(0).notNull(),
    shippingCents: integer("shipping_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    luluPrintJobId: text("lulu_print_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("orders_customer_idx").on(table.customerId),
    statusIdx: index("orders_status_idx").on(table.status),
  }),
);

export const orderAddresses = pgTable("order_addresses", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  countryCode: text("country_code").default("US").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const portalTokens = pgTable(
  "portal_tokens",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("portal_tokens_hash_idx").on(table.tokenHash),
    orderIdx: index("portal_tokens_order_idx").on(table.orderId),
  }),
);

export const uploads = pgTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    kind: uploadKindEnum("kind").default("original").notNull(),
    status: uploadStatusEnum("status").default("presigned").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    objectPath: text("object_path").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    objectPathIdx: uniqueIndex("uploads_object_path_idx").on(table.objectPath),
    orderIdx: index("uploads_order_idx").on(table.orderId),
  }),
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    kind: assetKindEnum("kind").notNull(),
    objectPath: text("object_path").notNull(),
    mimeType: text("mime_type").notNull(),
    pageNumber: integer("page_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    objectPathIdx: uniqueIndex("assets_object_path_idx").on(table.objectPath),
    orderIdx: index("assets_order_idx").on(table.orderId),
  }),
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    kind: generationJobKindEnum("kind").notNull(),
    status: generationJobStatusEnum("status").default("queued").notNull(),
    targetPages: integer("target_pages").default(1).notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("generation_jobs_order_idx").on(table.orderId),
  }),
);

export const generationPages = pgTable(
  "generation_pages",
  {
    id: text("id").primaryKey(),
    generationJobId: text("generation_job_id").notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
    uploadId: text("upload_id").references(() => uploads.id, { onDelete: "set null" }),
    pageNumber: integer("page_number").notNull(),
    status: generationPageStatusEnum("status").default("queued").notNull(),
    assetId: text("asset_id").references(() => assets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("generation_pages_job_idx").on(table.generationJobId),
  }),
);

export const shippingQuotes = pgTable(
  "shipping_quotes",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    label: text("label").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    window: text("window").notNull(),
    isSelected: boolean("is_selected").default(false).notNull(),
    quotePayload: jsonb("quote_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("shipping_quotes_order_idx").on(table.orderId),
  }),
);

export const fulfillmentJobs = pgTable(
  "fulfillment_jobs",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").default("lulu").notNull(),
    providerJobId: text("provider_job_id"),
    status: fulfillmentStatusEnum("status").default("draft").notNull(),
    shippingService: text("shipping_service"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("fulfillment_jobs_order_idx").on(table.orderId),
  }),
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    template: text("template").notNull(),
    provider: text("provider").default("stub").notNull(),
    providerMessageId: text("provider_message_id"),
    subject: text("subject"),
    status: emailEventStatusEnum("status").default("queued").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("email_events_order_idx").on(table.orderId),
  }),
);

export const supportActions = pgTable(
  "support_actions",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    actionType: supportActionTypeEnum("action_type").notNull(),
    pageNumber: integer("page_number"),
    notes: text("notes"),
    createdBy: text("created_by"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("support_actions_order_idx").on(table.orderId),
  }),
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    details: jsonb("details").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("order_events_order_idx").on(table.orderId),
  }),
);

export const tableNames = {
  customers: "customers",
  orders: "orders",
  orderAddresses: "order_addresses",
  uploads: "uploads",
  generationJobs: "generation_jobs",
  generationPages: "generation_pages",
  assets: "assets",
  shippingQuotes: "shipping_quotes",
  fulfillmentJobs: "fulfillment_jobs",
  emailEvents: "email_events",
  supportActions: "support_actions",
  orderEvents: "order_events",
  portalTokens: "portal_tokens",
} as const;
