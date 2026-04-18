import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
    featureConsent: boolean("feature_consent"),
    featureConsentAt: timestamp("feature_consent_at", { withTimezone: true }),
    marketingSyncedAt: timestamp("marketing_synced_at", { withTimezone: true }),
    resendContactId: text("resend_contact_id"),
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
    refundedCents: integer("refunded_cents").default(0).notNull(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderType: orderTypeEnum("order_type").notNull(),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),
    status: orderStatusEnum("status").default("draft").notNull(),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    acquisitionPath: text("acquisition_path").default("unknown").notNull(),
    entrySource: text("entry_source"),
    landingPath: text("landing_path"),
    firstTouch: jsonb("first_touch").$type<Record<string, unknown> | null>(),
    lastTouch: jsonb("last_touch").$type<Record<string, unknown> | null>(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
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
    clientIp: text("client_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    acquisitionPathIdx: index("orders_acquisition_path_idx").on(table.acquisitionPath),
    customerIdx: index("orders_customer_idx").on(table.customerId),
    visitorIdx: index("orders_visitor_idx").on(table.visitorId),
    statusIdx: index("orders_status_idx").on(table.status),
    stripeCheckoutSessionUnique: uniqueIndex("orders_stripe_checkout_session_unique")
      .on(table.stripeCheckoutSessionId)
      .where(sql`${table.stripeCheckoutSessionId} IS NOT NULL`),
    luluPrintJobIdx: index("orders_lulu_print_job_idx")
      .on(table.luluPrintJobId)
      .where(sql`${table.luluPrintJobId} IS NOT NULL`),
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
    provider: text("provider"),
    model: text("model"),
    fallbackProvider: text("fallback_provider"),
    fallbackModel: text("fallback_model"),
    promptVersion: text("prompt_version"),
    cleanupVersion: text("cleanup_version"),
    acceptedPageCount: integer("accepted_page_count").default(0).notNull(),
    failedPageCount: integer("failed_page_count").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
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
    provider: text("provider"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    cleanupVersion: text("cleanup_version"),
    qaScore: doublePrecision("qa_score"),
    qaFlags: jsonb("qa_flags").$type<string[] | null>(),
    qaMetrics: jsonb("qa_metrics").$type<Record<string, unknown> | null>(),
    renderAttempts: integer("render_attempts").default(1).notNull(),
    costCents: integer("cost_cents"),
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

export const customerUserLinks = pgTable(
  "customer_user_links",
  {
    id: text("id").primaryKey(),
    stackUserId: text("stack_user_id").notNull(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    source: text("source").default("post_purchase").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stackUserUnique: uniqueIndex("customer_user_links_stack_user_id_unique").on(table.stackUserId),
    customerIdx: index("customer_user_links_customer_idx").on(table.customerId),
  }),
);

export const stripeWebhookEventStatusValues = ["received", "processed", "ignored", "failed"] as const;

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    type: text("type").notNull(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: text("status").default("received").notNull().$type<(typeof stripeWebhookEventStatusValues)[number]>(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
  },
  (table) => ({
    eventIdUnique: uniqueIndex("stripe_webhook_events_event_id_unique").on(table.stripeEventId),
    orderIdx: index("stripe_webhook_events_order_idx").on(table.orderId),
  }),
);

export const broadcastArchetypeValues = ["sunday_show_off", "thursday_gallery", "ad_hoc"] as const;
export const broadcastStatusValues = ["drafted", "scheduled", "sending", "sent", "failed", "cancelled"] as const;

export const broadcastSends = pgTable(
  "broadcast_sends",
  {
    id: text("id").primaryKey(),
    archetype: text("archetype").notNull().$type<(typeof broadcastArchetypeValues)[number]>(),
    status: text("status").default("drafted").notNull().$type<(typeof broadcastStatusValues)[number]>(),
    resendBroadcastId: text("resend_broadcast_id"),
    resendAudienceId: text("resend_audience_id"),
    subject: text("subject"),
    preheader: text("preheader"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    contactsCount: integer("contacts_count"),
    selection: jsonb("selection").$type<Record<string, unknown> | null>(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    resendIdUnique: uniqueIndex("broadcast_sends_resend_id_unique").on(table.resendBroadcastId),
    archetypeScheduledIdx: index("broadcast_sends_archetype_scheduled_idx").on(
      table.archetype,
      table.scheduledFor,
    ),
  }),
);

export const emailSendSequenceValues = ["welcome", "post_purchase", "re_engagement", "abandonment"] as const;
export const emailSendStatusValues = [
  "queued",
  "scheduled",
  "sent",
  "failed",
  "skipped",
  "bounced",
  "complained",
] as const;

export const emailSends = pgTable(
  "email_sends",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    sequence: text("sequence").$type<(typeof emailSendSequenceValues)[number] | null>(),
    step: integer("step"),
    template: text("template").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject"),
    provider: text("provider").default("resend").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").default("queued").notNull().$type<(typeof emailSendStatusValues)[number]>(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerSequenceIdx: index("email_sends_customer_sequence_idx").on(
      table.customerId,
      table.sequence,
      table.step,
    ),
  }),
);

export const sequenceStateStatusValues = ["active", "paused", "completed", "stopped", "purchased"] as const;

export const emailSequenceStates = pgTable(
  "email_sequence_states",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    sequence: text("sequence").notNull().$type<(typeof emailSendSequenceValues)[number]>(),
    status: text("status").default("active").notNull().$type<(typeof sequenceStateStatusValues)[number]>(),
    currentStep: integer("current_step").default(0).notNull(),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastSendAt: timestamp("last_send_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  },
  (table) => ({
    customerSequenceUnique: uniqueIndex("email_sequence_states_customer_sequence_unique").on(
      table.customerId,
      table.sequence,
    ),
  }),
);

export const ticketCategoryValues = [
  "refund_request",
  "print_quality",
  "shipping_damage",
  "shipping_delay",
  "wrong_item",
  "page_rerender",
  "account_help",
  "other",
] as const;

export const ticketStatusValues = [
  "open",
  "awaiting_customer",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const ticketPriorityValues = ["low", "normal", "high", "urgent"] as const;
export const ticketAuthorValues = ["customer", "admin", "system"] as const;

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    category: text("category").notNull().$type<(typeof ticketCategoryValues)[number]>(),
    status: text("status").default("open").notNull().$type<(typeof ticketStatusValues)[number]>(),
    priority: text("priority").default("normal").notNull().$type<(typeof ticketPriorityValues)[number]>(),
    subject: text("subject").notNull(),
    summary: text("summary"),
    assignedAdminEmail: text("assigned_admin_email"),
    firstResponseDueAt: timestamp("first_response_due_at", { withTimezone: true }),
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("tickets_customer_idx").on(table.customerId, table.createdAt),
    orderIdx: index("tickets_order_idx").on(table.orderId),
    openIdx: index("tickets_open_idx").on(table.status, table.firstResponseDueAt),
  }),
);

export const refundStatusValues = [
  "requested",
  "approved",
  "processing",
  "succeeded",
  "failed",
  "voided",
] as const;

export const refundReasonValues = [
  "customer_request_no_questions",
  "print_quality",
  "shipping_damage",
  "shipping_lost",
  "duplicate_charge",
  "fraud",
  "admin_discretion",
  "other",
] as const;

export const refundPolicyTierValues = [
  "full_pre_lulu",
  "full_digital",
  "partial_in_production",
  "full_shipped_quality",
  "replacement_shipped_quality",
  "replacement_shipping_damage",
  "store_credit_change_of_mind",
  "manual",
] as const;

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    status: text("status").default("requested").notNull().$type<(typeof refundStatusValues)[number]>(),
    reason: text("reason").notNull().$type<(typeof refundReasonValues)[number]>(),
    amountCents: integer("amount_cents").notNull(),
    refundedCents: integer("refunded_cents"),
    stripeRefundId: text("stripe_refund_id"),
    stripeError: jsonb("stripe_error").$type<Record<string, unknown> | null>(),
    requestedByEmail: text("requested_by_email"),
    approvedByEmail: text("approved_by_email"),
    policyTier: text("policy_tier").notNull().$type<(typeof refundPolicyTierValues)[number]>(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stripeRefundUnique: uniqueIndex("refunds_stripe_refund_unique").on(table.stripeRefundId),
    orderIdx: index("refunds_order_idx").on(table.orderId),
    ticketIdx: index("refunds_ticket_idx").on(table.ticketId),
  }),
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    author: text("author").notNull().$type<(typeof ticketAuthorValues)[number]>(),
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    internal: boolean("internal").default(false).notNull(),
    attachments: jsonb("attachments").$type<Array<Record<string, unknown>>>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("ticket_messages_ticket_idx").on(table.ticketId, table.createdAt),
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
  customerUserLinks: "customer_user_links",
  stripeWebhookEvents: "stripe_webhook_events",
  broadcastSends: "broadcast_sends",
  emailSends: "email_sends",
  emailSequenceStates: "email_sequence_states",
  tickets: "tickets",
  ticketMessages: "ticket_messages",
  refunds: "refunds",
  adSpendEntries: "ad_spend_entries",
} as const;

export const adSpendPlatformValues = ["meta", "google", "tiktok", "youtube", "reddit", "other"] as const;

export const adSpendEntries = pgTable(
  "ad_spend_entries",
  {
    id: text("id").primaryKey(),
    spendDate: text("spend_date").notNull(), // ISO date YYYY-MM-DD
    platform: text("platform").notNull().$type<(typeof adSpendPlatformValues)[number]>(),
    campaign: text("campaign"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    notes: text("notes"),
    recordedByEmail: text("recorded_by_email"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("ad_spend_entries_date_idx").on(table.spendDate),
    platformIdx: index("ad_spend_entries_platform_idx").on(table.platform, table.spendDate),
  }),
);
