import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
    costCents: integer("cost_cents"),
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
  metaTokens: "meta_tokens",
  metaAdAccounts: "meta_ad_accounts",
  metaPages: "meta_pages",
  metaInstagramAccounts: "meta_instagram_accounts",
  metaPixels: "meta_pixels",
  adCampaigns: "ad_campaigns",
  adSets: "ad_sets",
  ads: "ads",
  adCreatives: "ad_creatives",
  capiEvents: "capi_events",
  metaWebhookEvents: "meta_webhook_events",
  metaApiCalls: "meta_api_calls",
  organicPosts: "organic_posts",
  organicPostMetrics: "organic_post_metrics",
  adDailyMetrics: "ad_daily_metrics",
  adsetDailyMetrics: "adset_daily_metrics",
  campaignDailyMetrics: "campaign_daily_metrics",
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

// ─── Meta Growth System — Phase 1 ────────────────────────────────────────────

export const capiEventStatusValues = ["queued", "sending", "sent", "failed"] as const;
export const metaWebhookStatusValues = ["received", "processed", "failed"] as const;

export const capiEventStatusEnum = pgEnum("capi_event_status", capiEventStatusValues);
export const metaWebhookStatusEnum = pgEnum("meta_webhook_status", metaWebhookStatusValues);

export type CapiEventStatus = (typeof capiEventStatusValues)[number];
export type MetaWebhookStatus = (typeof metaWebhookStatusValues)[number];

export const metaTokens = pgTable("meta_tokens", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  scopes: text("scopes").array().notNull().default(sql`'{}'`),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  encryptedToken: text("encrypted_token").notNull().default(""),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const metaAdAccounts = pgTable(
  "meta_ad_accounts",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(),
    businessId: text("business_id").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("meta_ad_accounts_meta_id_unique").on(table.metaId),
  }),
);

export const metaPages = pgTable(
  "meta_pages",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    username: text("username"),
    categoryText: text("category_text"),
    igUserId: text("ig_user_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("meta_pages_meta_id_unique").on(table.metaId),
  }),
);

export const metaInstagramAccounts = pgTable(
  "meta_instagram_accounts",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    username: text("username").notNull(),
    name: text("name"),
    profilePictureUrl: text("profile_picture_url"),
    linkedPageMetaId: text("linked_page_meta_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("meta_instagram_accounts_meta_id_unique").on(table.metaId),
  }),
);

export const metaPixels = pgTable(
  "meta_pixels",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    datasetId: text("dataset_id").notNull(),
    lastEmqScore: numeric("last_emq_score", { precision: 3, scale: 1 }),
    lastEmqCheckedAt: timestamp("last_emq_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("meta_pixels_meta_id_unique").on(table.metaId),
  }),
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull(),
    specialAdCategories: text("special_ad_categories").array().notNull().default(sql`'{}'`),
    adAccountId: text("ad_account_id").notNull().references(() => metaAdAccounts.id, { onDelete: "cascade" }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("ad_campaigns_meta_id_unique").on(table.metaId),
    adAccountIdx: index("ad_campaigns_ad_account_idx").on(table.adAccountId),
  }),
);

export const adSets = pgTable(
  "ad_sets",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    campaignId: text("campaign_id").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    dailyBudgetCents: integer("daily_budget_cents"),
    lifetimeBudgetCents: integer("lifetime_budget_cents"),
    optimizationGoal: text("optimization_goal").notNull(),
    billingEvent: text("billing_event"),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    targetingJson: jsonb("targeting_json").$type<Record<string, unknown> | null>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("ad_sets_meta_id_unique").on(table.metaId),
    campaignIdx: index("ad_sets_campaign_idx").on(table.campaignId),
  }),
);

export const ads = pgTable(
  "ads",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name").notNull(),
    adSetId: text("ad_set_id").notNull().references(() => adSets.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    adCreativeMetaId: text("ad_creative_meta_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("ads_meta_id_unique").on(table.metaId),
    adSetIdx: index("ads_ad_set_idx").on(table.adSetId),
  }),
);

export const adCreatives = pgTable(
  "ad_creatives",
  {
    id: text("id").primaryKey(),
    metaId: text("meta_id").notNull(),
    name: text("name"),
    objectStoryId: text("object_story_id"),
    briefRef: text("brief_ref"),
    effectiveInstagramMediaId: text("effective_instagram_media_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metaIdUnique: uniqueIndex("ad_creatives_meta_id_unique").on(table.metaId),
  }),
);

export const capiEvents = pgTable(
  "capi_events",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
    actionSource: text("action_source").notNull(),
    userDataFingerprint: text("user_data_fingerprint").notNull(),
    payloadJson: jsonb("payload_json").notNull().$type<Record<string, unknown>>(),
    status: capiEventStatusEnum("status").notNull().default("queued"),
    metaEventsReceived: integer("meta_events_received"),
    metaTraceId: text("meta_trace_id"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdUnique: uniqueIndex("capi_events_event_id_unique").on(table.eventId),
    statusIdx: index("capi_events_status_idx").on(table.status),
    eventNameIdx: index("capi_events_event_name_idx").on(table.eventName),
    createdAtIdx: index("capi_events_created_at_idx").on(table.createdAt),
  }),
);

export const metaWebhookEvents = pgTable(
  "meta_webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("meta"),
    topic: text("topic").notNull(),
    objectType: text("object_type").notNull(),
    payloadJson: jsonb("payload_json").notNull().$type<Record<string, unknown>>(),
    signatureHeader: text("signature_header").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: metaWebhookStatusEnum("status").notNull().default("received"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("meta_webhook_events_status_idx").on(table.status),
    receivedAtIdx: index("meta_webhook_events_received_at_idx").on(table.receivedAt),
  }),
);

export const metaApiCalls = pgTable(
  "meta_api_calls",
  {
    id: text("id").primaryKey(),
    method: text("method").notNull(),
    endpoint: text("endpoint").notNull(),
    payloadHash: text("payload_hash"),
    responseStatus: integer("response_status"),
    responseExcerpt: text("response_excerpt"),
    bucUsagePercent: integer("buc_usage_percent"),
    durationMs: integer("duration_ms"),
    errorCode: integer("error_code"),
    errorSubcode: integer("error_subcode"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("meta_api_calls_created_at_idx").on(table.createdAt),
    endpointIdx: index("meta_api_calls_endpoint_idx").on(table.endpoint),
  }),
);

// ─── Organic Social Publishing — Phase 3a ────────────────────────────────────

export const organicPostStatusValues = ['draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled'] as const;
export const organicPostPlatformValues = ['fb', 'ig', 'fb_ig'] as const;
export const organicPostFormatValues = ['single_image', 'carousel', 'reel', 'story'] as const;

export const organicPostStatusEnum = pgEnum("organic_post_status", organicPostStatusValues);
export const organicPostPlatformEnum = pgEnum("organic_post_platform", organicPostPlatformValues);
export const organicPostFormatEnum = pgEnum("organic_post_format", organicPostFormatValues);

export type OrganicPostStatus = (typeof organicPostStatusValues)[number];
export type OrganicPostPlatform = (typeof organicPostPlatformValues)[number];
export type OrganicPostFormat = (typeof organicPostFormatValues)[number];

export const organicPosts = pgTable(
  "organic_posts",
  {
    id: text("id").primaryKey(),
    platform: organicPostPlatformEnum("platform").notNull(),
    format: organicPostFormatEnum("format").notNull(),
    status: organicPostStatusEnum("status").notNull().default("draft"),
    caption: text("caption").notNull(),
    firstComment: text("first_comment"),
    imageAssetIds: text("image_asset_ids").array().notNull().default(sql`'{}'`),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishingAttempts: integer("publishing_attempts").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metaFbPostId: text("meta_fb_post_id"),
    metaIgPostId: text("meta_ig_post_id"),
    errorMessage: text("error_message"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("organic_posts_status_idx").on(table.status),
    scheduledAtIdx: index("organic_posts_scheduled_at_idx").on(table.scheduledAt),
    publishedAtIdx: index("organic_posts_published_at_idx").on(table.publishedAt),
  }),
);

export const organicPostMetrics = pgTable(
  "organic_post_metrics",
  {
    id: text("id").primaryKey(),
    organicPostId: text("organic_post_id").notNull().references(() => organicPosts.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    platform: organicPostPlatformEnum("platform").notNull(),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    reactions: integer("reactions").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    engagementRate: numeric("engagement_rate", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    postObservedIdx: index("organic_post_metrics_post_observed_idx").on(table.organicPostId, table.observedAt),
  }),
);

export type OrganicPost = typeof organicPosts.$inferSelect;
export type NewOrganicPost = typeof organicPosts.$inferInsert;
export type OrganicPostMetric = typeof organicPostMetrics.$inferSelect;
export type NewOrganicPostMetric = typeof organicPostMetrics.$inferInsert;

export type MetaToken = typeof metaTokens.$inferSelect;
export type NewMetaToken = typeof metaTokens.$inferInsert;
export type MetaAdAccount = typeof metaAdAccounts.$inferSelect;
export type NewMetaAdAccount = typeof metaAdAccounts.$inferInsert;
export type MetaPage = typeof metaPages.$inferSelect;
export type MetaInstagramAccount = typeof metaInstagramAccounts.$inferSelect;
export type MetaPixel = typeof metaPixels.$inferSelect;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type NewAdCampaign = typeof adCampaigns.$inferInsert;
export type AdSet = typeof adSets.$inferSelect;
export type Ad = typeof ads.$inferSelect;
export type AdCreative = typeof adCreatives.$inferSelect;
export type CapiEvent = typeof capiEvents.$inferSelect;
export type NewCapiEvent = typeof capiEvents.$inferInsert;
export type MetaWebhookEvent = typeof metaWebhookEvents.$inferSelect;
export type MetaApiCall = typeof metaApiCalls.$inferSelect;
export type NewMetaApiCall = typeof metaApiCalls.$inferInsert;

// ─── Phase 3d — Daily metrics rollup ─────────────────────────────────────────

const dailyMetricsColumns = {
  id: text("id").primaryKey(),
  entityMetaId: text("entity_meta_id").notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD; stored as text to avoid timezone ambiguity
  impressions: integer("impressions").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  frequency: numeric("frequency", { precision: 6, scale: 3 }),
  spendCents: integer("spend_cents").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  linkClicks: integer("link_clicks").notNull().default(0),
  landingPageViews: integer("landing_page_views").notNull().default(0),
  addsToCart: integer("adds_to_cart").notNull().default(0),
  initiateCheckouts: integer("initiate_checkouts").notNull().default(0),
  purchases: integer("purchases").notNull().default(0),
  revenueCents: integer("revenue_cents").notNull().default(0),
  ctr: numeric("ctr", { precision: 6, scale: 4 }),
  cpmCents: integer("cpm_cents"),
  cpcCents: integer("cpc_cents"),
  cpaCents: integer("cpa_cents"),
  roas: numeric("roas", { precision: 8, scale: 4 }),
  videoP25Views: integer("video_p25_views").notNull().default(0),
  videoP50Views: integer("video_p50_views").notNull().default(0),
  videoP75Views: integer("video_p75_views").notNull().default(0),
  videoP100Views: integer("video_p100_views").notNull().default(0),
  hookRate: numeric("hook_rate", { precision: 6, scale: 4 }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const adDailyMetrics = pgTable(
  "ad_daily_metrics",
  dailyMetricsColumns,
  (table) => ({
    entityDateUnique: uniqueIndex("ad_daily_metrics_entity_date_unique").on(table.entityMetaId, table.date),
    dateIdx: index("ad_daily_metrics_date_idx").on(table.date),
    entityDateDescIdx: index("ad_daily_metrics_entity_date_desc_idx").on(table.entityMetaId, table.date),
  }),
);

export const adsetDailyMetrics = pgTable(
  "adset_daily_metrics",
  dailyMetricsColumns,
  (table) => ({
    entityDateUnique: uniqueIndex("adset_daily_metrics_entity_date_unique").on(table.entityMetaId, table.date),
    dateIdx: index("adset_daily_metrics_date_idx").on(table.date),
    entityDateDescIdx: index("adset_daily_metrics_entity_date_desc_idx").on(table.entityMetaId, table.date),
  }),
);

export const campaignDailyMetrics = pgTable(
  "campaign_daily_metrics",
  dailyMetricsColumns,
  (table) => ({
    entityDateUnique: uniqueIndex("campaign_daily_metrics_entity_date_unique").on(table.entityMetaId, table.date),
    dateIdx: index("campaign_daily_metrics_date_idx").on(table.date),
    entityDateDescIdx: index("campaign_daily_metrics_entity_date_desc_idx").on(table.entityMetaId, table.date),
  }),
);

export type AdDailyMetric = typeof adDailyMetrics.$inferSelect;
export type NewAdDailyMetric = typeof adDailyMetrics.$inferInsert;
export type AdsetDailyMetric = typeof adsetDailyMetrics.$inferSelect;
export type NewAdsetDailyMetric = typeof adsetDailyMetrics.$inferInsert;
export type CampaignDailyMetric = typeof campaignDailyMetrics.$inferSelect;
export type NewCampaignDailyMetric = typeof campaignDailyMetrics.$inferInsert;
