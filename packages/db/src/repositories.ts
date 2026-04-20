import crypto from "node:crypto";
import { and, asc, avg, count, desc, eq, gt, gte, inArray, isNotNull, lt, lte, ne, sql, sum } from "drizzle-orm";
import {
  getNormalizedOrderQuantity,
  getOfferByCode,
  getOfferSubtotalForQuantity,
  normalizeCopyNames,
  normalizeCoverStyle,
  normalizePrintBundleCode,
  type RenderFallback,
} from "@littlecolorbook/shared";
import { getDatabase, isDatabaseConfigured } from "./client";
import {
  adSpendEntries,
  adSpendPlatformValues,
  broadcastSends,
  customers,
  customerUserLinks,
  emailSends,
  emailSequenceStates,
  orderAddresses,
  orderEvents,
  orders,
  portalTokens,
  refunds,
  refundPolicyTierValues,
  refundReasonValues,
  refundStatusValues,
  shippingQuotes,
  stripeWebhookEvents,
  ticketMessages,
  tickets,
  uploads,
  assets,
  emailEvents,
  fulfillmentJobs,
  generationJobs,
  generationPages,
  supportActions,
  assetKindValues,
  deliveryModeValues,
  emailEventStatusValues,
  emailSendSequenceValues,
  emailSendStatusValues,
  fulfillmentStatusValues,
  generationJobKindValues,
  generationJobStatusValues,
  generationPageStatusValues,
  orderStatusValues,
  orderTypeValues,
  supportActionTypeValues,
  ticketAuthorValues,
  ticketCategoryValues,
  ticketPriorityValues,
  ticketStatusValues,
  capiEvents,
  capiEventStatusValues,
  metaApiCalls,
  organicPosts,
  organicPostMetrics,
  organicPostApprovalStatusValues,
  adCampaigns,
  adSets,
  ads,
  adCreatives,
  adDailyMetrics,
  adsetDailyMetrics,
  campaignDailyMetrics,
  agentProposals,
  agentJournal,
  agentBaselines,
  creativeRequests,
  creativeBriefs,
  creativeAssets,
  metaWebhookEvents,
  dmThreads,
  dmMessages,
  dmKeywordResponses,
} from "./schema";
import type {
  CapiEventStatus,
  OrganicPostStatus,
  OrganicPostPlatform,
  OrganicPostFormat,
  OrganicPostApprovalStatus,
  AgentProposalKind,
  AgentProposalStatus,
  AgentJournalEntryKind,
  CreativeAssetSource,
  CreativeAssetKind,
  CreativeAssetComplianceStatus,
  CreativeBriefKind,
  CreativeAssetTagsJson,
  NewCreativeBrief,
  NewCreativeAsset,
  DmPlatform,
  DmThreadStatus,
  DmMessageDirection,
  DmAttachment,
  DmThread,
  DmMessage,
  MetaWebhookStatus,
  DmKeywordResponse,
  NewDmKeywordResponse,
  KeywordResponseMatchKind,
} from "./schema";

export type OrderType = (typeof orderTypeValues)[number];
export type DeliveryMode = (typeof deliveryModeValues)[number];
export type AssetKind = (typeof assetKindValues)[number];
export type FulfillmentStatus = (typeof fulfillmentStatusValues)[number];
export type GenerationJobKind = (typeof generationJobKindValues)[number];
export type GenerationJobStatus = (typeof generationJobStatusValues)[number];
export type GenerationPageStatus = (typeof generationPageStatusValues)[number];
export type OrderStatus = (typeof orderStatusValues)[number];
export type EmailEventStatus = (typeof emailEventStatusValues)[number];
export type SupportActionType = (typeof supportActionTypeValues)[number];

export type CreateOrderInput = {
  email: string;
  orderType: OrderType;
  deliveryMode: DeliveryMode;
  visitorId?: string | null;
  sessionId?: string | null;
  acquisitionPath?: string | null;
  entrySource?: string | null;
  landingPath?: string | null;
  firstTouch?: Record<string, unknown> | null;
  lastTouch?: Record<string, unknown> | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  selectedOfferCode: string;
  designCount: number;
  quantity?: number;
  bundleSelection?: string | null;
  coverStyle?: string | null;
  occasion?: string | null;
  occasionContext?: Record<string, unknown> | null;
  copyNames?: Array<string | null> | null;
  childFirstName?: string | null;
  dedicationText?: string | null;
  subtotalCents?: number;
  shippingCents?: number;
  totalCents?: number;
  clientIp?: string | null;
};

export type UpsertCustomerInput = {
  email: string;
  firstName?: string | null;
  phone?: string | null;
  marketingOptIn?: boolean;
};

export type AddressInput = {
  fullName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode?: string;
  phone?: string | null;
};

export type ShippingQuoteInput = {
  service: string;
  label: string;
  quantity?: number;
  shippingCents: number;
  window: string;
  isSelected?: boolean;
  quotePayload?: Record<string, unknown> | null;
};

export type UploadPlaceholderInput = {
  orderId: string;
  fileName: string;
  contentType: string;
  objectPath: string;
  kind?: "original" | "reference";
};


export type PortalSummary = {
  databaseConfigured: boolean;
  portalHref: string;
  order: {
    id: string;
    orderType: OrderType;
    deliveryMode: DeliveryMode;
    status: OrderStatus;
    visitorId: string | null;
    sessionId: string | null;
    acquisitionPath: string;
    entrySource: string | null;
    landingPath: string | null;
    firstTouch: Record<string, unknown> | null;
    lastTouch: Record<string, unknown> | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    selectedOfferCode: string;
    designCount: number;
    quantity: number;
    bundleSelection: string | null;
    coverStyle: string;
    occasion: string | null;
    occasionContext: Record<string, unknown> | null;
    copyNames: Array<string | null> | null;
    childFirstName: string | null;
    dedicationText: string | null;
    subtotalCents: number;
    totalCents: number;
    shippingCents: number;
    createdAt: Date;
  };
  customer: {
    email: string;
    firstName: string | null;
    phone: string | null;
  } | null;
  shippingAddress: {
    fullName: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
    phone: string | null;
  } | null;
  uploads: Array<{
    id: string;
    fileName: string;
    objectPath: string;
    status: "presigned" | "uploaded" | "failed";
  }>;
  quotes: Array<{
    id: string;
    service: string;
    label: string;
    quantity: number;
    shippingCents: number;
    window: string;
    isSelected: boolean;
  }>;
  fulfillment: {
    provider: string;
    providerJobId: string | null;
    status: FulfillmentStatus;
    shippingService: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
  assets: {
    downloadPdfPath: string | null;
    interiorPdfPath: string | null;
    coverPdfPath: string | null;
    previewPath: string | null;
    previewPaths: string[];
    generatedPagePaths: string[];
    generatedPageCount: number;
    previewCount: number;
  };
  events: Array<{
    id: string;
    eventType: string;
    details: Record<string, unknown> | null;
    createdAt: Date;
  }>;
  emails: Array<{
    id: string;
    template: string;
    provider: string;
    status: EmailEventStatus;
    createdAt: Date;
    sentAt: Date | null;
  }>;
  supportActions: Array<{
    id: string;
    actionType: SupportActionType;
    pageNumber: number | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: Date;
  }>;
};

export type AdminQueueItem = {
  id: string;
  status: OrderStatus;
  deliveryMode: DeliveryMode;
  selectedOfferCode: string;
  totalCents: number;
  designCount: number;
  childFirstName: string | null;
  customerEmail: string | null;
  createdAt: Date;
  luluPrintJobId: string | null;
};

export type AdminOrderDetail = PortalSummary & {
  generationJobs: Array<{
    id: string;
    kind: GenerationJobKind;
    status: "queued" | "running" | "completed" | "failed";
    targetPages: number;
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
    cleanupVersion: string | null;
    acceptedPageCount: number;
    failedPageCount: number;
    queuedPages: number;
    approvedPages: number;
    failedPages: number;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }>;
};

export type LuluSyncCandidate = {
  orderId: string;
  providerJobId: string;
  status: OrderStatus;
};

function now() {
  return new Date();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeTrackingValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeAcquisitionPath(value?: string | null) {
  const normalized = normalizeTrackingValue(value);
  return normalized ?? "unknown";
}

function createPortalTokenValue() {
  return crypto.randomBytes(24).toString("hex");
}

function hashPortalToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function allowDevelopmentFallbacks() {
  return process.env.NODE_ENV !== "production";
}

function resolveOrderCommerce(input: {
  currentBundleSelection?: string | null;
  currentQuantity?: number | null;
  currentSelectedOfferCode?: string | null;
  quantity?: number | null;
  bundleSelection?: string | null;
  selectedOfferCode?: string | null;
  shippingCents?: number | null;
}) {
  const offer = getOfferByCode(input.selectedOfferCode ?? input.currentSelectedOfferCode ?? "pdf-30");
  const bundleSelection = offer.format === "print" ? normalizePrintBundleCode(input.bundleSelection ?? input.currentBundleSelection ?? null) : null;
  const quantity = getNormalizedOrderQuantity({
    format: offer.format,
    quantity: input.quantity ?? input.currentQuantity ?? 1,
    bundleSelection,
  });
  const subtotalCents = getOfferSubtotalForQuantity(offer, {
    quantity,
    bundleSelection,
  });
  const shippingCents = Math.max(0, Math.trunc(input.shippingCents ?? 0));

  return {
    selectedOfferCode: offer.code,
    designCount: offer.designs,
    quantity,
    bundleSelection,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  };
}

export async function upsertCustomerByEmail(input: UpsertCustomerInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const customer = {
    id: createId("cus"),
    email: normalizedEmail,
    firstName: input.firstName ?? null,
    phone: input.phone ?? null,
    marketingOptIn: input.marketingOptIn ?? false,
    createdAt: now(),
    updatedAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...customer,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const existing = await db.query.customers.findFirst({
    where: eq(customers.email, normalizedEmail),
  });

  if (existing) {
    const updated = {
      firstName: input.firstName ?? existing.firstName,
      phone: input.phone ?? existing.phone,
      marketingOptIn: input.marketingOptIn ?? existing.marketingOptIn,
      updatedAt: now(),
    };

    await db.update(customers).set(updated).where(eq(customers.id, existing.id));

    return {
      ...existing,
      ...updated,
      databaseConfigured: true,
    };
  }

  await db.insert(customers).values(customer);

  return {
    ...customer,
    databaseConfigured: true,
  };
}

export async function createOrderDraft(input: CreateOrderInput) {
  const customer = await upsertCustomerByEmail({
    email: input.email,
  });

  const initialCommerce = resolveOrderCommerce({
    selectedOfferCode: input.selectedOfferCode,
    quantity: input.quantity ?? 1,
    bundleSelection: input.bundleSelection ?? null,
    shippingCents: input.shippingCents ?? 0,
  });

  const order = {
    id: createId("ord"),
    customerId: customer.id,
    orderType: input.orderType,
    deliveryMode: input.deliveryMode,
    status: "draft" as OrderStatus,
    visitorId: normalizeTrackingValue(input.visitorId),
    sessionId: normalizeTrackingValue(input.sessionId),
    acquisitionPath: normalizeAcquisitionPath(input.acquisitionPath),
    entrySource: normalizeTrackingValue(input.entrySource),
    landingPath: normalizeTrackingValue(input.landingPath),
    firstTouch: input.firstTouch ?? null,
    lastTouch: input.lastTouch ?? null,
    utmSource: normalizeTrackingValue(input.utmSource),
    utmMedium: normalizeTrackingValue(input.utmMedium),
    utmCampaign: normalizeTrackingValue(input.utmCampaign),
    utmContent: normalizeTrackingValue(input.utmContent),
    utmTerm: normalizeTrackingValue(input.utmTerm),
    selectedOfferCode: initialCommerce.selectedOfferCode,
    designCount: initialCommerce.designCount,
    quantity: initialCommerce.quantity,
    bundleSelection: initialCommerce.bundleSelection,
    coverStyle: normalizeCoverStyle(input.coverStyle),
    occasion: normalizeTrackingValue(input.occasion),
    occasionContext: input.occasionContext ?? null,
    copyNames: normalizeCopyNames(input.copyNames, initialCommerce.quantity),
    childFirstName: input.childFirstName ?? null,
    dedicationText: input.dedicationText ?? null,
    currency: "usd",
    subtotalCents: initialCommerce.subtotalCents,
    shippingCents: initialCommerce.shippingCents,
    totalCents: initialCommerce.totalCents,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    luluPrintJobId: null,
    clientIp: input.clientIp ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  const portalToken = createPortalTokenValue();
  const portalTokenRecord = {
    id: createId("ptok"),
    orderId: order.id,
    tokenHash: hashPortalToken(portalToken),
    email: customer.email,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    usedAt: null,
    createdAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      databaseConfigured: false,
      customer,
      order,
      portalToken,
      portalUrl: `/order/${portalToken}`,
    };
  }

  const db = getDatabase();
  await db.insert(orders).values(order);
  await db.insert(portalTokens).values(portalTokenRecord);
  await db.insert(orderEvents).values({
    id: createId("evt"),
    orderId: order.id,
    eventType: "order.created",
    details: {
      orderType: input.orderType,
      deliveryMode: input.deliveryMode,
      visitorId: order.visitorId,
      sessionId: order.sessionId,
      acquisitionPath: order.acquisitionPath,
      entrySource: order.entrySource,
      landingPath: order.landingPath,
      firstTouch: order.firstTouch,
      lastTouch: order.lastTouch,
      utmSource: order.utmSource,
      utmMedium: order.utmMedium,
      utmCampaign: order.utmCampaign,
      utmContent: order.utmContent,
      utmTerm: order.utmTerm,
      selectedOfferCode: input.selectedOfferCode,
      quantity: order.quantity,
      bundleSelection: order.bundleSelection,
      coverStyle: order.coverStyle,
      occasion: order.occasion,
      occasionContext: order.occasionContext,
      copyNames: order.copyNames,
    },
    createdAt: now(),
  });

  return {
    databaseConfigured: true,
    customer,
    order,
    portalToken,
    portalUrl: `/order/${portalToken}`,
  };
}

export async function upsertOrderAddress(orderId: string, input: AddressInput) {
  const address = {
    id: createId("addr"),
    orderId,
    fullName: input.fullName ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    countryCode: input.countryCode ?? "US",
    phone: input.phone ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...address,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const existing = await db.query.orderAddresses.findFirst({
    where: eq(orderAddresses.orderId, orderId),
  });

  if (existing) {
    const updated = {
      ...address,
      id: existing.id,
      createdAt: existing.createdAt,
    };

    await db.update(orderAddresses).set(updated).where(eq(orderAddresses.id, existing.id));
    return {
      ...updated,
      databaseConfigured: true,
    };
  }

  await db.insert(orderAddresses).values(address);

  return {
    ...address,
    databaseConfigured: true,
  };
}

export async function createUploadPlaceholder(input: UploadPlaceholderInput) {
  const upload = {
    id: createId("upl"),
    orderId: input.orderId,
    kind: input.kind ?? "original",
    status: "presigned" as const,
    fileName: input.fileName,
    contentType: input.contentType,
    objectPath: input.objectPath,
    uploadedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...upload,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const existing = await db.query.uploads.findFirst({
    where: eq(uploads.objectPath, input.objectPath),
  });

  if (existing) {
    return {
      ...existing,
      databaseConfigured: true,
    };
  }

  await db.insert(uploads).values(upload);

  return {
    ...upload,
    databaseConfigured: true,
  };
}

export async function markUploadCompleted(orderId: string, objectPath: string) {
  if (!isDatabaseConfigured()) {
    return {
      orderId,
      objectPath,
      status: "uploaded" as const,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const upload = await db.query.uploads.findFirst({
    where: and(eq(uploads.orderId, orderId), eq(uploads.objectPath, objectPath)),
  });

  if (!upload) {
    throw new Error("Upload record not found for completion.");
  }

  const updated = {
    status: "uploaded" as const,
    uploadedAt: now(),
    updatedAt: now(),
  };

  await db.update(uploads).set(updated).where(eq(uploads.id, upload.id));
  await db.insert(orderEvents).values({
    id: createId("evt"),
    orderId,
    eventType: "upload.completed",
    details: {
      uploadId: upload.id,
      objectPath,
    },
    createdAt: now(),
  });

  return {
    ...upload,
    ...updated,
    databaseConfigured: true,
  };
}

export async function saveShippingQuotes(orderId: string, quotes: ShippingQuoteInput[]) {
  const storedQuotes = quotes.map((quote) => ({
    id: createId("ship"),
    orderId,
    service: quote.service,
    label: quote.label,
    quantity: quote.quantity ?? 1,
    shippingCents: quote.shippingCents,
    window: quote.window,
    isSelected: quote.isSelected ?? false,
    quotePayload: quote.quotePayload ?? null,
    createdAt: now(),
  }));

  if (!isDatabaseConfigured()) {
    return storedQuotes.map((quote) => ({
      ...quote,
      databaseConfigured: false,
    }));
  }

  const db = getDatabase();
  const existing = await db.query.shippingQuotes.findMany({
    where: eq(shippingQuotes.orderId, orderId),
  });

  if (existing.length > 0) {
    for (const quote of existing) {
      await db.delete(shippingQuotes).where(eq(shippingQuotes.id, quote.id));
    }
  }

  await db.insert(shippingQuotes).values(storedQuotes);

  return storedQuotes.map((quote) => ({
    ...quote,
    databaseConfigured: true,
  }));
}

export async function updateOrderClientIp(orderId: string, clientIp: string) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db.update(orders).set({ clientIp, updatedAt: now() }).where(eq(orders.id, orderId));
}

/**
 * Record per-order consent to feature the source photo + generated
 * coloring page in the creative library / ads / gallery. Captured on
 * sample submission (checkbox) and re-confirmable via the post-
 * purchase consent form. Setting true timestamps the consent; setting
 * false clears the timestamp so the ingestion cron can't pick the
 * order back up once revoked.
 */
export async function updateOrderFeatureConsent(orderId: string, consent: boolean) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(orders)
    .set({
      featureConsent: consent,
      featureConsentAt: consent ? now() : null,
      updatedAt: now(),
    })
    .where(eq(orders.id, orderId));
}

/**
 * Mark an order as ingested into the creative library so the
 * ingest-consented-samples cron doesn't pick it up again.
 */
export async function markOrderFeatureIngested(orderId: string) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(orders)
    .set({ featureIngestedAt: now(), updatedAt: now() })
    .where(eq(orders.id, orderId));
}

/**
 * Return consented sample orders ready for ingestion into the
 * creative library. "Ready" = feature_consent=true AND feature_
 * ingested_at IS NULL AND status is a terminal sample state.
 * Joined with the first upload (source photo) and the latest
 * generated-page asset (coloring page) so the caller can copy
 * both into the creative library in one pass.
 */
export async function listConsentedSamplesForIngestion(input: { limit?: number } = {}): Promise<Array<{
  orderId: string;
  customerEmail: string | null;
  childFirstName: string | null;
  sourceObjectPath: string | null;
  coloringObjectPath: string | null;
}>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const limit = input.limit ?? 100;
  const rows = await db.execute(sql<{
    order_id: string;
    customer_email: string | null;
    child_first_name: string | null;
    source_object_path: string | null;
    coloring_object_path: string | null;
  }>`
    SELECT
      o.id AS order_id,
      c.email AS customer_email,
      o.child_first_name AS child_first_name,
      up.object_path AS source_object_path,
      ga.object_path AS coloring_object_path
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN LATERAL (
      SELECT object_path
      FROM uploads
      WHERE order_id = o.id
      ORDER BY created_at ASC
      LIMIT 1
    ) up ON true
    LEFT JOIN LATERAL (
      SELECT object_path
      FROM assets
      WHERE order_id = o.id
        AND kind IN ('generated_page', 'preview')
      ORDER BY created_at DESC
      LIMIT 1
    ) ga ON true
    WHERE o.order_type = 'sample'
      AND o.feature_consent = true
      AND o.feature_ingested_at IS NULL
      AND o.status IN ('pdf_ready', 'delivered')
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);
  return (rows as unknown as Array<{
    order_id: string;
    customer_email: string | null;
    child_first_name: string | null;
    source_object_path: string | null;
    coloring_object_path: string | null;
  }>).map((row) => ({
    orderId: row.order_id,
    customerEmail: row.customer_email,
    childFirstName: row.child_first_name,
    sourceObjectPath: row.source_object_path,
    coloringObjectPath: row.coloring_object_path,
  }));
}

export async function updateOrderCommerceSelection(input: {
  orderId: string;
  selectedOfferCode?: string | null;
  quantity?: number | null;
  bundleSelection?: string | null;
  shippingCents?: number | null;
}) {
  const commerce = resolveOrderCommerce({
    currentSelectedOfferCode: input.selectedOfferCode ?? null,
    quantity: input.quantity,
    bundleSelection: input.bundleSelection,
    shippingCents: input.shippingCents,
    currentQuantity: input.quantity,
  });

  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      ...commerce,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for commerce update.");
  }

  const updated = {
    ...resolveOrderCommerce({
      currentSelectedOfferCode: order.selectedOfferCode,
      currentQuantity: order.quantity,
      currentBundleSelection: order.bundleSelection,
      selectedOfferCode: input.selectedOfferCode ?? order.selectedOfferCode,
      quantity: input.quantity ?? order.quantity,
      bundleSelection: input.bundleSelection ?? order.bundleSelection,
      shippingCents: input.shippingCents ?? order.shippingCents,
    }),
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "order.commerce_updated", {
    selectedOfferCode: updated.selectedOfferCode,
    quantity: updated.quantity,
    bundleSelection: updated.bundleSelection,
    subtotalCents: updated.subtotalCents,
    shippingCents: updated.shippingCents,
    totalCents: updated.totalCents,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function getOrderById(orderId: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return getDatabase().query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
}

export async function createPortalAccessForOrder(orderId: string) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  if (!isDatabaseConfigured()) {
    if (!allowDevelopmentFallbacks()) {
      return null;
    }

    const portalToken = createPortalTokenValue();
    return {
      databaseConfigured: false,
      portalToken,
      portalHref: `/order/${portalToken}`,
      expiresAt,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    return null;
  }

  const customer = order.customerId
    ? await db.query.customers.findFirst({
        where: eq(customers.id, order.customerId),
      })
    : null;

  if (!customer?.email) {
    throw new Error('Cannot create portal access without a customer email.');
  }

  const portalToken = createPortalTokenValue();
  const portalTokenRecord = {
    id: createId('ptok'),
    orderId: order.id,
    tokenHash: hashPortalToken(portalToken),
    email: customer.email,
    expiresAt,
    usedAt: null,
    createdAt: now(),
  };

  await db.insert(portalTokens).values(portalTokenRecord);
  await appendOrderEvent(order.id, 'portal.access_issued', {
    expiresAt: expiresAt.toISOString(),
  });

  return {
    databaseConfigured: true,
    portalToken,
    portalHref: `/order/${portalToken}`,
    expiresAt,
  };
}

export async function appendOrderEvent(orderId: string, eventType: string, details: Record<string, unknown> | null = null) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await getDatabase().insert(orderEvents).values({
    id: createId("evt"),
    orderId,
    eventType,
    details,
    createdAt: now(),
  });
}


export async function getOrderByStripeCheckoutSessionId(stripeCheckoutSessionId: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return getDatabase().query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, stripeCheckoutSessionId),
  });
}

export async function attachStripeCheckoutSessionToOrder(input: {
  orderId: string;
  stripeCheckoutSessionId: string;
  selectedOfferCode?: string | null;
  quantity?: number | null;
  bundleSelection?: string | null;
  shippingQuoteId?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      status: "awaiting_payment" as const,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for checkout session attachment.");
  }

  const commerceSelection = resolveOrderCommerce({
    currentSelectedOfferCode: order.selectedOfferCode,
    currentQuantity: order.quantity,
    currentBundleSelection: order.bundleSelection,
    selectedOfferCode: input.selectedOfferCode ?? order.selectedOfferCode,
    quantity: input.quantity ?? order.quantity,
    bundleSelection: input.bundleSelection ?? order.bundleSelection,
    shippingCents: order.shippingCents,
  });

  let shippingCents = order.shippingCents;
  let totalCents = commerceSelection.totalCents;

  if (input.shippingQuoteId) {
    const selectedQuote = await db.query.shippingQuotes.findFirst({
      where: and(eq(shippingQuotes.id, input.shippingQuoteId), eq(shippingQuotes.orderId, input.orderId)),
    });

    if (!selectedQuote) {
      throw new Error("Shipping quote not found for checkout session attachment.");
    }

    if (selectedQuote.quantity !== commerceSelection.quantity) {
      throw new Error("Selected shipping quote does not match the current print quantity.");
    }

    await db.update(shippingQuotes).set({ isSelected: false }).where(eq(shippingQuotes.orderId, input.orderId));
    await db.update(shippingQuotes).set({ isSelected: true }).where(eq(shippingQuotes.id, selectedQuote.id));

    shippingCents = selectedQuote.shippingCents;
    totalCents = commerceSelection.subtotalCents + selectedQuote.shippingCents;
  }

  const updated = {
    status: "awaiting_payment" as OrderStatus,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    selectedOfferCode: commerceSelection.selectedOfferCode,
    designCount: commerceSelection.designCount,
    quantity: commerceSelection.quantity,
    bundleSelection: commerceSelection.bundleSelection,
    subtotalCents: commerceSelection.subtotalCents,
    shippingCents,
    totalCents,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "checkout.session_created", {
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    shippingQuoteId: input.shippingQuoteId ?? null,
    selectedOfferCode: commerceSelection.selectedOfferCode,
    quantity: commerceSelection.quantity,
    bundleSelection: commerceSelection.bundleSelection,
    shippingCents,
    subtotalCents: commerceSelection.subtotalCents,
    totalCents,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function markOrderPaidFromCheckout(input: {
  orderId: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  amountTotalCents?: number | null;
  rawEventId?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      status: "paid" as const,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for payment reconciliation.");
  }

  const updated = {
    status: "paid" as OrderStatus,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? order.stripeCheckoutSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId ?? order.stripePaymentIntentId,
    totalCents: input.amountTotalCents ?? order.totalCents,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "checkout.session_completed", {
    stripeCheckoutSessionId: updated.stripeCheckoutSessionId,
    stripePaymentIntentId: updated.stripePaymentIntentId,
    rawEventId: input.rawEventId ?? null,
    totalCents: updated.totalCents,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function markOrderCheckoutExpired(input: {
  orderId: string;
  stripeCheckoutSessionId?: string | null;
  rawEventId?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      status: "draft" as const,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for checkout expiration.");
  }

  const updated = {
    status: "draft" as OrderStatus,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "checkout.session_expired", {
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? order.stripeCheckoutSessionId,
    rawEventId: input.rawEventId ?? null,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  eventType = "order.status_updated",
  details: Record<string, unknown> | null = null,
) {
  if (!isDatabaseConfigured()) {
    return {
      orderId,
      status,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    throw new Error("Order not found for status update.");
  }

  const updated = {
    status,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, orderId));
  await appendOrderEvent(orderId, eventType, details);

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function setGenerationJobStatus(
  generationJobId: string,
  status: GenerationJobStatus,
  eventType = "generation.job_status_updated",
  details: Record<string, unknown> | null = null,
) {
  if (!isDatabaseConfigured()) {
    return {
      generationJobId,
      status,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, generationJobId),
  });

  if (!job) {
    throw new Error("Generation job not found for status update.");
  }

  const nextModel = typeof details?.model === "string" && details.model.trim() ? details.model : null;
  const nextProvider = typeof details?.provider === "string" && details.provider.trim() ? details.provider : null;
  const nextFallbackModel =
    typeof details?.fallbackModel === "string" && details.fallbackModel.trim() ? details.fallbackModel : null;
  const nextFallbackProvider =
    typeof details?.fallbackProvider === "string" && details.fallbackProvider.trim() ? details.fallbackProvider : null;
  const nextPromptVersion =
    typeof details?.promptVersion === "string" && details.promptVersion.trim() ? details.promptVersion : null;
  const nextCleanupVersion =
    typeof details?.cleanupVersion === "string" && details.cleanupVersion.trim() ? details.cleanupVersion : null;
  const nextAcceptedPageCount = typeof details?.acceptedPageCount === "number" ? Math.max(0, Math.trunc(details.acceptedPageCount)) : null;
  const nextFailedPageCount = typeof details?.failedPageCount === "number" ? Math.max(0, Math.trunc(details.failedPageCount)) : null;
  const updated = {
    ...(nextAcceptedPageCount !== null ? { acceptedPageCount: nextAcceptedPageCount } : {}),
    ...(nextCleanupVersion ? { cleanupVersion: nextCleanupVersion } : {}),
    ...(status === "completed" || status === "failed" ? { completedAt: now() } : {}),
    ...(nextFailedPageCount !== null ? { failedPageCount: nextFailedPageCount } : {}),
    ...(nextFallbackModel ? { fallbackModel: nextFallbackModel } : {}),
    ...(nextFallbackProvider ? { fallbackProvider: nextFallbackProvider } : {}),
    ...(nextModel ? { model: nextModel } : {}),
    ...(nextPromptVersion ? { promptVersion: nextPromptVersion } : {}),
    ...(nextProvider ? { provider: nextProvider } : {}),
    ...(status === "running" && !job.startedAt ? { startedAt: now() } : {}),
    status,
    updatedAt: now(),
  };

  await db.update(generationJobs).set(updated).where(eq(generationJobs.id, generationJobId));
  await appendOrderEvent(job.orderId, eventType, {
    generationJobId,
    status,
    ...(details ?? {}),
  });

  return {
    ...job,
    ...updated,
    databaseConfigured: true,
  };
}

export async function setGenerationPageStatus(
  generationPageId: string,
  status: GenerationPageStatus,
  eventType = "generation.page_status_updated",
  details: Record<string, unknown> | null = null,
) {
  if (!isDatabaseConfigured()) {
    return {
      generationPageId,
      status,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const page = await db.query.generationPages.findFirst({
    where: eq(generationPages.id, generationPageId),
  });

  if (!page) {
    throw new Error("Generation page not found for status update.");
  }

  const updated = {
    ...(details && typeof details.cleanupVersion === "string" && details.cleanupVersion.trim()
      ? { cleanupVersion: details.cleanupVersion }
      : {}),
    ...(details && typeof details.model === "string" && details.model.trim() ? { model: details.model } : {}),
    ...(details && typeof details.promptVersion === "string" && details.promptVersion.trim()
      ? { promptVersion: details.promptVersion }
      : {}),
    ...(details && typeof details.provider === "string" && details.provider.trim() ? { provider: details.provider } : {}),
    ...(details && typeof details.qaScore === "number" ? { qaScore: details.qaScore } : {}),
    ...(details && Array.isArray(details.qaFlags) ? { qaFlags: details.qaFlags.filter((flag): flag is string => typeof flag === "string") } : {}),
    ...(details && details.qaMetrics && typeof details.qaMetrics === "object" ? { qaMetrics: details.qaMetrics as Record<string, unknown> } : {}),
    ...(details && typeof details.renderAttempts === "number" ? { renderAttempts: Math.max(1, Math.trunc(details.renderAttempts)) } : {}),
    ...(details && typeof details.costCents === "number" ? { costCents: Math.max(0, Math.trunc(details.costCents)) } : {}),
    status,
    updatedAt: now(),
  };

  await db.update(generationPages).set(updated).where(eq(generationPages.id, generationPageId));

  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, page.generationJobId),
  });

  if (job) {
    await appendOrderEvent(job.orderId, eventType, {
      generationJobId: job.id,
      generationPageId,
      pageNumber: page.pageNumber,
      status,
      ...(details ?? {}),
    });
  }

  return {
    ...page,
    ...updated,
    databaseConfigured: true,
  };
}

export async function updateOrderCustomization(input: {
  orderId: string;
  childFirstName?: string | null;
  coverStyle?: string | null;
  dedicationText?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for customization update.");
  }

  const updated: Partial<typeof order> & { updatedAt: Date } = {
    updatedAt: now(),
  };

  if (input.childFirstName !== undefined) {
    updated.childFirstName = input.childFirstName;
  }

  if (input.coverStyle !== undefined) {
    updated.coverStyle = normalizeCoverStyle(input.coverStyle);
  }

  if (input.dedicationText !== undefined) {
    updated.dedicationText = input.dedicationText;
  }

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "order.customization_updated", {
    childFirstName: updated.childFirstName ?? null,
    coverStyle: updated.coverStyle ?? null,
    dedicationText: updated.dedicationText ?? null,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function listUploadsForOrder(orderId: string) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return getDatabase().query.uploads.findMany({
    where: eq(uploads.orderId, orderId),
    orderBy: [desc(uploads.createdAt)],
  });
}

export async function getUploadsByIds(uploadIds: string[]) {
  if (!isDatabaseConfigured() || uploadIds.length === 0) {
    return [];
  }

  return getDatabase().query.uploads.findMany({
    where: inArray(uploads.id, uploadIds),
    orderBy: [desc(uploads.createdAt)],
  });
}

export async function getAssetsByIds(assetIds: string[]) {
  if (!isDatabaseConfigured() || assetIds.length === 0) {
    return [];
  }

  return getDatabase().query.assets.findMany({
    where: inArray(assets.id, assetIds),
    orderBy: [desc(assets.createdAt)],
  });
}

export async function createAssetRecords(
  input: Array<{
    orderId: string;
    kind: AssetKind;
    objectPath: string;
    mimeType: string;
    pageNumber?: number | null;
  }>,
) {
  const records = input.map((asset) => ({
    id: createId("ast"),
    orderId: asset.orderId,
    kind: asset.kind,
    objectPath: asset.objectPath,
    mimeType: asset.mimeType,
    pageNumber: asset.pageNumber ?? null,
    createdAt: now(),
  }));

  if (!isDatabaseConfigured()) {
    return records.map((record) => ({
      ...record,
      databaseConfigured: false,
    }));
  }

  const db = getDatabase();

  for (const record of records) {
    const existing = await db.query.assets.findFirst({
      where: eq(assets.objectPath, record.objectPath),
    });

    if (!existing) {
      await db.insert(assets).values(record);
    }
  }

  const saved = await Promise.all(
    records.map(async (record) =>
      db.query.assets.findFirst({
        where: eq(assets.objectPath, record.objectPath),
      }),
    ),
  );

  return saved.filter((record): record is NonNullable<typeof record> => Boolean(record));
}

export async function createGenerationJobRecord(input: {
  orderId: string;
  kind: GenerationJobKind;
  targetPages: number;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  cleanupVersion?: string | null;
} & RenderFallback) {
  const record = {
    id: createId("gen"),
    orderId: input.orderId,
    kind: input.kind,
    status: "queued" as const,
    targetPages: input.targetPages,
    provider: input.provider ?? null,
    model: input.model ?? null,
    fallbackProvider: input.fallbackProvider ?? null,
    fallbackModel: input.fallbackModel ?? null,
    promptVersion: input.promptVersion ?? null,
    cleanupVersion: input.cleanupVersion ?? null,
    acceptedPageCount: 0,
    failedPageCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...record,
      databaseConfigured: false,
    };
  }

  await getDatabase().insert(generationJobs).values(record);
  await appendOrderEvent(input.orderId, "generation.job_created", {
    generationJobId: record.id,
    kind: input.kind,
    targetPages: input.targetPages,
  });

  return {
    ...record,
    databaseConfigured: true,
  };
}

export async function seedGenerationPages(
  generationJobId: string,
  pages: Array<{
    pageNumber: number;
    uploadId?: string | null;
    assetId?: string | null;
  }>,
) {
  const records = pages.map((page) => ({
    id: createId("gpg"),
    generationJobId,
    uploadId: page.uploadId ?? null,
    pageNumber: page.pageNumber,
    status: "queued" as const,
    assetId: page.assetId ?? null,
    createdAt: now(),
    updatedAt: now(),
  }));

  if (!isDatabaseConfigured()) {
    return records.map((record) => ({
      ...record,
      databaseConfigured: false,
    }));
  }

  await getDatabase().insert(generationPages).values(records);
  return records.map((record) => ({
    ...record,
    databaseConfigured: true,
  }));
}

function mapLuluStatus(status: string | null | undefined): {
  fulfillmentStatus: FulfillmentStatus;
  orderStatus: OrderStatus;
} {
  const normalized = (status ?? "").toUpperCase();

  switch (normalized) {
    case "SHIPPED":
      return {
        fulfillmentStatus: "shipped",
        orderStatus: "shipped",
      };
    case "DELIVERED":
      return {
        fulfillmentStatus: "delivered",
        orderStatus: "delivered",
      };
    case "IN_PRODUCTION":
    case "PRODUCTION_READY":
    case "PRODUCTION_DELAYED":
      return {
        fulfillmentStatus: "in_production",
        orderStatus: "in_production",
      };
    case "ERROR":
    case "REJECTED":
    case "CANCELED":
      return {
        fulfillmentStatus: "failed",
        orderStatus: "failed",
      };
    case "CREATED":
    case "UNPAID":
    case "PAYMENT_IN_PROGRESS":
    default:
      return {
        fulfillmentStatus: "submitted",
        orderStatus: "submitted_to_lulu",
      };
  }
}

export type PrintSubmissionCandidate = {
  orderId: string;
  interiorPdfPath: string | null;
  coverPdfPaths: string[];
  copyNames: Array<string | null> | null;
  childFirstName: string | null;
};

export async function listPrintSubmissionCandidates(limit = 50): Promise<PrintSubmissionCandidate[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDatabase();
  const pendingOrders = await db
    .select({ id: orders.id, copyNames: orders.copyNames, childFirstName: orders.childFirstName })
    .from(orders)
    .where(eq(orders.status, "awaiting_print_submission"))
    .orderBy(desc(orders.updatedAt))
    .limit(limit);

  if (pendingOrders.length === 0) {
    return [];
  }

  const orderIds = pendingOrders.map((o) => o.id);
  const relatedAssets = await db.query.assets.findMany({
    where: and(
      inArray(assets.orderId, orderIds),
      inArray(assets.kind, ["interior_pdf", "cover_pdf"]),
    ),
  });

  return pendingOrders.map((order) => {
    const orderAssets = relatedAssets.filter((a) => a.orderId === order.id);
    const interiorPdfPath = orderAssets.find((a) => a.kind === "interior_pdf")?.objectPath ?? null;
    const coverPdfPaths = orderAssets
      .filter((a) => a.kind === "cover_pdf")
      .map((a) => a.objectPath);

    return {
      orderId: order.id,
      interiorPdfPath,
      coverPdfPaths,
      copyNames: order.copyNames,
      childFirstName: order.childFirstName,
    };
  });
}

export async function getDownloadAssetForOrder(orderId: string): Promise<{ objectPath: string } | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = getDatabase();
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.orderId, orderId), eq(assets.kind, "download_pdf")),
  });

  return asset ? { objectPath: asset.objectPath } : null;
}

export async function listLuluSyncCandidates(limit = 25): Promise<LuluSyncCandidate[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDatabase();
  const rows = await db
    .select({
      orderId: orders.id,
      providerJobId: orders.luluPrintJobId,
      status: orders.status,
    })
    .from(orders)
    .where(and(inArray(orders.status, ["submitted_to_lulu", "in_production", "shipped"]), isNotNull(orders.luluPrintJobId)))
    .orderBy(desc(orders.updatedAt))
    .limit(limit);

  return rows
    .filter((row): row is { orderId: string; providerJobId: string; status: OrderStatus } => Boolean(row.providerJobId))
    .map((row) => ({
      orderId: row.orderId,
      providerJobId: row.providerJobId,
      status: row.status,
    }));
}

export async function getFulfillmentOrderContext(orderId: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    return null;
  }

  const customer = order.customerId
    ? await db.query.customers.findFirst({
        where: eq(customers.id, order.customerId),
      })
    : null;
  const shippingAddress = await db.query.orderAddresses.findFirst({
    where: eq(orderAddresses.orderId, orderId),
  });
  const selectedQuote = await db.query.shippingQuotes.findFirst({
    where: and(eq(shippingQuotes.orderId, orderId), eq(shippingQuotes.isSelected, true)),
  });
  const fulfillmentJob = await db.query.fulfillmentJobs.findFirst({
    where: eq(fulfillmentJobs.orderId, orderId),
  });

  return {
    databaseConfigured: true,
    order,
    customerEmail: customer?.email ?? null,
    shippingAddress,
    selectedQuote,
    fulfillmentJob,
  };
}

async function upsertFulfillmentJob(input: {
  orderId: string;
  providerJobId?: string | null;
  status: FulfillmentStatus;
  shippingService?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  rawPayload?: Record<string, unknown> | null;
  costCents?: number | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      providerJobId: input.providerJobId ?? null,
      status: input.status,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const existing = await db.query.fulfillmentJobs.findFirst({
    where: eq(fulfillmentJobs.orderId, input.orderId),
  });

  if (existing) {
    const updated = {
      providerJobId: input.providerJobId ?? existing.providerJobId,
      status: input.status,
      shippingService: input.shippingService ?? existing.shippingService,
      trackingNumber: input.trackingNumber ?? existing.trackingNumber,
      trackingUrl: input.trackingUrl ?? existing.trackingUrl,
      rawPayload: input.rawPayload ?? existing.rawPayload,
      costCents: input.costCents ?? existing.costCents,
      updatedAt: now(),
    };

    await db.update(fulfillmentJobs).set(updated).where(eq(fulfillmentJobs.id, existing.id));

    return {
      ...existing,
      ...updated,
      databaseConfigured: true,
    };
  }

  const created = {
    id: createId("ful"),
    orderId: input.orderId,
    provider: "lulu",
    providerJobId: input.providerJobId ?? null,
    status: input.status,
    shippingService: input.shippingService ?? null,
    trackingNumber: input.trackingNumber ?? null,
    trackingUrl: input.trackingUrl ?? null,
    rawPayload: input.rawPayload ?? null,
    costCents: input.costCents ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db.insert(fulfillmentJobs).values(created);

  return {
    ...created,
    databaseConfigured: true,
  };
}

export async function markOrderSubmittedToLulu(input: {
  orderId: string;
  providerJobId: string;
  shippingService?: string | null;
  rawPayload?: Record<string, unknown> | null;
  costCents?: number | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      providerJobId: input.providerJobId,
      status: "submitted_to_lulu" as const,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for Lulu submission.");
  }

  await upsertFulfillmentJob({
    orderId: input.orderId,
    providerJobId: input.providerJobId,
    status: "submitted",
    shippingService: input.shippingService ?? null,
    rawPayload: input.rawPayload ?? null,
    costCents: input.costCents ?? null,
  });

  const updated = {
    status: "submitted_to_lulu" as OrderStatus,
    luluPrintJobId: input.providerJobId,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "lulu.job_submitted", {
    providerJobId: input.providerJobId,
    shippingService: input.shippingService ?? null,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

export async function syncOrderWithLuluStatus(input: {
  orderId: string;
  providerJobId?: string | null;
  providerStatus: string;
  shippingService?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  if (!isDatabaseConfigured()) {
    return {
      orderId: input.orderId,
      providerJobId: input.providerJobId ?? null,
      providerStatus: input.providerStatus,
      databaseConfigured: false,
    };
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
  });

  if (!order) {
    throw new Error("Order not found for Lulu status sync.");
  }

  const mapped = mapLuluStatus(input.providerStatus);
  await upsertFulfillmentJob({
    orderId: input.orderId,
    providerJobId: input.providerJobId ?? order.luluPrintJobId,
    status: mapped.fulfillmentStatus,
    shippingService: input.shippingService ?? null,
    trackingNumber: input.trackingNumber ?? null,
    trackingUrl: input.trackingUrl ?? null,
    rawPayload: input.rawPayload ?? null,
  });

  const updated = {
    status: mapped.orderStatus,
    luluPrintJobId: input.providerJobId ?? order.luluPrintJobId,
    updatedAt: now(),
  };

  await db.update(orders).set(updated).where(eq(orders.id, input.orderId));
  await appendOrderEvent(input.orderId, "lulu.status_synced", {
    providerJobId: input.providerJobId ?? order.luluPrintJobId,
    providerStatus: input.providerStatus,
    trackingNumber: input.trackingNumber ?? null,
    trackingUrl: input.trackingUrl ?? null,
  });

  return {
    ...order,
    ...updated,
    databaseConfigured: true,
  };
}

function buildDemoPortalSummary(portalKey: string): PortalSummary {
  return {
    databaseConfigured: false,
    portalHref: `/order/${portalKey}`,
    order: {
      id: "ord_demo_portal",
      orderType: "pdf",
      deliveryMode: "pdf",
      status: "pdf_ready",
      visitorId: "visitor_demo_portal",
      sessionId: "session_demo_portal",
      acquisitionPath: "sample_first",
      entrySource: "development-demo",
      landingPath: "/sample",
      firstTouch: {
        landingPath: "/sample",
        referrer: null,
        capturedAt: new Date().toISOString(),
      },
      lastTouch: {
        landingPath: "/sample",
        referrer: null,
        capturedAt: new Date().toISOString(),
      },
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      selectedOfferCode: "pdf-30",
      designCount: 30,
      quantity: 1,
      bundleSelection: null,
      coverStyle: "storybook",
      occasion: "everyday",
      occasionContext: { childName: "Mila" },
      copyNames: null,
      childFirstName: "Mila",
      dedicationText: "Made for rainy afternoons.",
      subtotalCents: 2499,
      totalCents: 2499,
      shippingCents: 0,
      createdAt: now(),
    },
    customer: {
      email: "parent@example.com",
      firstName: "Avery",
      phone: null,
    },
    shippingAddress: null,
    uploads: [
      {
        id: "upl_demo_1",
        fileName: "beach-day.jpg",
        objectPath: "orders/ord_demo_portal/original/beach-day.jpg",
        status: "uploaded",
      },
    ],
    quotes: [],
    fulfillment: null,
    assets: {
      downloadPdfPath: "orders/ord_demo_portal/pdf/download.pdf",
      interiorPdfPath: "orders/ord_demo_portal/pdf/interior.pdf",
      coverPdfPath: null,
      previewPath: "orders/ord_demo_portal/pages/1/preview.jpg",
      previewPaths: [
        "orders/ord_demo_portal/pages/1/preview.jpg",
        "orders/ord_demo_portal/pages/2/preview.jpg",
        "orders/ord_demo_portal/pages/3/preview.jpg",
      ],
      generatedPagePaths: [
        "orders/ord_demo_portal/pages/1/generated.png",
        "orders/ord_demo_portal/pages/2/generated.png",
        "orders/ord_demo_portal/pages/3/generated.png",
      ],
      generatedPageCount: 30,
      previewCount: 30,
    },
    events: [
      {
        id: "evt_demo_paid",
        eventType: "checkout.session_completed",
        details: { totalCents: 2499 },
        createdAt: now(),
      },
      {
        id: "evt_demo_pdf",
        eventType: "pdf.ready",
        details: null,
        createdAt: now(),
      },
    ],
    emails: [],
    supportActions: [],
  };
}

async function buildPortalSummaryFromOrder(order: typeof orders.$inferSelect, portalHref: string): Promise<PortalSummary> {
  const db = getDatabase();

  const customer = order.customerId
    ? await db.query.customers.findFirst({
        where: eq(customers.id, order.customerId),
      })
    : null;
  const shippingAddress = await db.query.orderAddresses.findFirst({
    where: eq(orderAddresses.orderId, order.id),
  });
  const relatedUploads = await db.query.uploads.findMany({
    where: eq(uploads.orderId, order.id),
    orderBy: [desc(uploads.createdAt)],
  });
  const quotes = await db.query.shippingQuotes.findMany({
    where: eq(shippingQuotes.orderId, order.id),
    orderBy: [desc(shippingQuotes.createdAt)],
  });
  const relatedAssets = await db.query.assets.findMany({
    where: eq(assets.orderId, order.id),
    orderBy: [desc(assets.createdAt)],
  });
  const fulfillmentJob = await db.query.fulfillmentJobs.findFirst({
    where: eq(fulfillmentJobs.orderId, order.id),
  });
  const previewAssets = relatedAssets.filter((asset) => asset.kind === "preview");
  const generatedPageAssets = relatedAssets.filter((asset) => asset.kind === "generated_page");
  const timeline = await db.query.orderEvents.findMany({
    where: eq(orderEvents.orderId, order.id),
    orderBy: [desc(orderEvents.createdAt)],
    limit: 12,
  });
  const sentEmails = await db.query.emailEvents.findMany({
    where: eq(emailEvents.orderId, order.id),
    orderBy: [desc(emailEvents.createdAt)],
    limit: 12,
  });
  const adminActions = await db.query.supportActions.findMany({
    where: eq(supportActions.orderId, order.id),
    orderBy: [desc(supportActions.createdAt)],
    limit: 12,
  });

  return {
    databaseConfigured: true,
    portalHref,
    order: {
      id: order.id,
      orderType: order.orderType,
      deliveryMode: order.deliveryMode,
      status: order.status,
      visitorId: order.visitorId,
      sessionId: order.sessionId,
      acquisitionPath: order.acquisitionPath,
      entrySource: order.entrySource,
      landingPath: order.landingPath,
      firstTouch: order.firstTouch,
      lastTouch: order.lastTouch,
      utmSource: order.utmSource,
      utmMedium: order.utmMedium,
      utmCampaign: order.utmCampaign,
      utmContent: order.utmContent,
      utmTerm: order.utmTerm,
      selectedOfferCode: order.selectedOfferCode,
      designCount: order.designCount,
      quantity: order.quantity,
      bundleSelection: order.bundleSelection,
      coverStyle: order.coverStyle,
      occasion: order.occasion,
      occasionContext: order.occasionContext,
      copyNames: order.copyNames,
      childFirstName: order.childFirstName,
      dedicationText: order.dedicationText,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      createdAt: order.createdAt,
    },
    customer: customer
      ? {
          email: customer.email,
          firstName: customer.firstName,
          phone: customer.phone,
        }
      : null,
    shippingAddress: shippingAddress
      ? {
          fullName: shippingAddress.fullName,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          countryCode: shippingAddress.countryCode,
          phone: shippingAddress.phone,
        }
      : null,
    uploads: relatedUploads.map((upload) => ({
      id: upload.id,
      fileName: upload.fileName,
      objectPath: upload.objectPath,
      status: upload.status,
    })),
    quotes: quotes.map((quote) => ({
      id: quote.id,
      service: quote.service,
      label: quote.label,
      quantity: quote.quantity,
      shippingCents: quote.shippingCents,
      window: quote.window,
      isSelected: quote.isSelected,
    })),
    fulfillment: fulfillmentJob
      ? {
          provider: fulfillmentJob.provider,
          providerJobId: fulfillmentJob.providerJobId,
          status: fulfillmentJob.status,
          shippingService: fulfillmentJob.shippingService,
          trackingNumber: fulfillmentJob.trackingNumber,
          trackingUrl: fulfillmentJob.trackingUrl,
        }
      : null,
    assets: {
      downloadPdfPath: relatedAssets.find((asset) => asset.kind === "download_pdf")?.objectPath ?? null,
      interiorPdfPath: relatedAssets.find((asset) => asset.kind === "interior_pdf")?.objectPath ?? null,
      coverPdfPath: relatedAssets.find((asset) => asset.kind === "cover_pdf")?.objectPath ?? null,
      previewPath: previewAssets[0]?.objectPath ?? null,
      previewPaths: previewAssets.map((asset) => asset.objectPath),
      generatedPagePaths: generatedPageAssets.map((asset) => asset.objectPath),
      generatedPageCount: generatedPageAssets.length,
      previewCount: previewAssets.length,
    },
    events: timeline.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      details: event.details,
      createdAt: event.createdAt,
    })),
    emails: sentEmails.map((email) => ({
      id: email.id,
      template: email.template,
      provider: email.provider,
      status: email.status,
      createdAt: email.createdAt,
      sentAt: email.sentAt,
    })),
    supportActions: adminActions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      pageNumber: action.pageNumber,
      notes: action.notes,
      createdBy: action.createdBy,
      createdAt: action.createdAt,
    })),
  };
}

async function getGenerationJobSummaries(orderId: string): Promise<AdminOrderDetail["generationJobs"]> {
  if (!isDatabaseConfigured()) {
    if (!allowDevelopmentFallbacks()) {
      return [];
    }

    return [
      {
        id: "gen_demo_1",
        kind: "full_book",
        status: "completed",
        targetPages: 30,
        provider: "gemini",
        model: "gemini-2.5-flash-image",
        promptVersion: "demo",
        cleanupVersion: "demo",
        acceptedPageCount: 30,
        failedPageCount: 0,
        queuedPages: 0,
        approvedPages: 30,
        failedPages: 0,
        createdAt: now(),
        startedAt: now(),
        completedAt: now(),
        updatedAt: now(),
      },
    ];
  }

  const db = getDatabase();
  const jobs = await db.query.generationJobs.findMany({
    where: eq(generationJobs.orderId, orderId),
    orderBy: [desc(generationJobs.createdAt)],
  });

  return Promise.all(
    jobs.map(async (job) => {
      const pages = await db.query.generationPages.findMany({
        where: eq(generationPages.generationJobId, job.id),
      });

      return {
        id: job.id,
        kind: job.kind,
        status: job.status,
        targetPages: job.targetPages,
        provider: job.provider,
        model: job.model,
        promptVersion: job.promptVersion,
        cleanupVersion: job.cleanupVersion,
        acceptedPageCount: job.acceptedPageCount,
        failedPageCount: job.failedPageCount,
        queuedPages: pages.filter((page) => page.status === "queued" || page.status === "generated").length,
        approvedPages: pages.filter((page) => page.status === "approved").length,
        failedPages: pages.filter((page) => page.status === "failed").length,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        updatedAt: job.updatedAt,
      };
    }),
  );
}

export async function getOrderPortalSummary(token: string): Promise<PortalSummary | null> {
  if (!isDatabaseConfigured()) {
    return allowDevelopmentFallbacks() ? buildDemoPortalSummary(token) : null;
  }

  const db = getDatabase();
  const tokenHash = hashPortalToken(token);
  const portal = await db.query.portalTokens.findFirst({
    where: and(eq(portalTokens.tokenHash, tokenHash), gt(portalTokens.expiresAt, now())),
    orderBy: [desc(portalTokens.createdAt)],
  });

  if (!portal) {
    return null;
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, portal.orderId),
  });

  if (!order) {
    return null;
  }

  return buildPortalSummaryFromOrder(order, `/order/${token}`);
}

export async function getOrderPortalSummaryByOrderId(orderId: string): Promise<PortalSummary | null> {
  if (!isDatabaseConfigured()) {
    return allowDevelopmentFallbacks() ? buildDemoPortalSummary(orderId) : null;
  }

  const order = await getDatabase().query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    return null;
  }

  return buildPortalSummaryFromOrder(order, "");
}

export async function listAdminOrders(limit = 25): Promise<AdminQueueItem[]> {
  if (!isDatabaseConfigured()) {
    if (!allowDevelopmentFallbacks()) {
      return [];
    }

    const demo = buildDemoPortalSummary("demo-order");
    return [
      {
        id: demo.order.id,
        status: demo.order.status,
        deliveryMode: demo.order.deliveryMode,
        selectedOfferCode: demo.order.selectedOfferCode,
        totalCents: demo.order.totalCents,
        designCount: demo.order.designCount,
        childFirstName: demo.order.childFirstName,
        customerEmail: demo.customer?.email ?? null,
        createdAt: demo.order.createdAt,
        luluPrintJobId: null,
      },
    ];
  }

  const db = getDatabase();
  const recentOrders = await db.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    limit,
  });

  return Promise.all(
    recentOrders.map(async (order) => {
      const customer = order.customerId
        ? await db.query.customers.findFirst({
            where: eq(customers.id, order.customerId),
          })
        : null;

      return {
        id: order.id,
        status: order.status,
        deliveryMode: order.deliveryMode,
        selectedOfferCode: order.selectedOfferCode,
        totalCents: order.totalCents,
        designCount: order.designCount,
        childFirstName: order.childFirstName,
        customerEmail: customer?.email ?? null,
        createdAt: order.createdAt,
        luluPrintJobId: order.luluPrintJobId,
      };
    }),
  );
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const summary = await getOrderPortalSummaryByOrderId(orderId);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    generationJobs: await getGenerationJobSummaries(summary.order.id),
  };
}

export async function hasLifecycleEmailBeenSent(orderId: string, template: string) {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const existing = await getDatabase().query.emailEvents.findFirst({
    where: and(eq(emailEvents.orderId, orderId), eq(emailEvents.template, template), eq(emailEvents.status, "sent")),
  });

  return Boolean(existing);
}

export async function recordLifecycleEmailEvent(input: {
  orderId: string;
  template: string;
  status: EmailEventStatus;
  provider?: string | null;
  providerMessageId?: string | null;
  subject?: string | null;
  payload?: Record<string, unknown> | null;
  sentAt?: Date | null;
}) {
  const record = {
    id: createId("eml"),
    orderId: input.orderId,
    template: input.template,
    provider: input.provider ?? "stub",
    providerMessageId: input.providerMessageId ?? null,
    subject: input.subject ?? null,
    status: input.status,
    payload: input.payload ?? null,
    sentAt: input.sentAt ?? null,
    createdAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...record,
      databaseConfigured: false,
    };
  }

  await getDatabase().insert(emailEvents).values(record);
  await appendOrderEvent(input.orderId, "email.lifecycle_recorded", {
    template: input.template,
    status: input.status,
    provider: input.provider ?? "stub",
  });

  return {
    ...record,
    databaseConfigured: true,
  };
}

export async function countSamplesByEmail(email: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const normalizedEmail = normalizeEmail(email);
  const db = getDatabase();

  const customer = await db.query.customers.findFirst({
    where: eq(customers.email, normalizedEmail),
  });

  if (!customer) {
    return 0;
  }

  const result = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, customer.id),
        eq(orders.orderType, "sample"),
        ne(orders.status, "failed"),
      ),
    );

  return result[0]?.total ?? 0;
}

export async function countSamplesByIp(
  ip: string,
  options: { createdAfter?: Date | null } = {},
): Promise<number> {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const db = getDatabase();
  const conditions = [
    eq(orders.clientIp, ip),
    eq(orders.orderType, "sample"),
    ne(orders.status, "failed"),
    ...(options.createdAfter ? [gte(orders.createdAt, options.createdAfter)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(orders)
    .where(and(...conditions));

  return result[0]?.total ?? 0;
}

export async function countSamplesByVisitor(visitorId: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const db = getDatabase();
  const result = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        eq(orders.visitorId, visitorId),
        eq(orders.orderType, "sample"),
        inArray(orders.status, ["draft", "preprocessing", "generating", "qa_review"]),
      ),
    );

  return result[0]?.total ?? 0;
}

export type SampleResumeCandidate = {
  orderId: string;
  matchedBy: "email" | "visitor";
  status: OrderStatus;
};

/**
 * Finds the most recent resumable sample for an email or active sample on a visitor.
 * Email matches are preferred so returning users can resume from any device.
 */
export async function findSampleResumeCandidate(input: {
  email: string;
  visitorId?: string | null;
}): Promise<SampleResumeCandidate | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const db = getDatabase();

  const customer = await db.query.customers.findFirst({
    where: eq(customers.email, normalizedEmail),
  });

  if (customer) {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.customerId, customer.id),
        eq(orders.orderType, "sample"),
        ne(orders.status, "failed"),
      ),
      orderBy: [desc(orders.createdAt)],
    });

    if (order) {
      return {
        orderId: order.id,
        matchedBy: "email",
        status: order.status,
      };
    }
  }

  if (!input.visitorId) {
    return null;
  }

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.visitorId, input.visitorId),
      eq(orders.orderType, "sample"),
      inArray(orders.status, ["draft", "preprocessing", "generating", "qa_review"]),
    ),
    orderBy: [desc(orders.createdAt)],
  });

  if (!order) {
    return null;
  }

  return {
    orderId: order.id,
    matchedBy: "visitor",
    status: order.status,
  };
}

export async function recordSupportAction(input: {
  orderId: string;
  actionType: SupportActionType;
  pageNumber?: number | null;
  notes?: string | null;
  createdBy?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const record = {
    id: createId("sup"),
    orderId: input.orderId,
    actionType: input.actionType,
    pageNumber: input.pageNumber ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    payload: input.payload ?? null,
    createdAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return {
      ...record,
      databaseConfigured: false,
    };
  }

  await getDatabase().insert(supportActions).values(record);
  await appendOrderEvent(input.orderId, "support.action_recorded", {
    actionType: input.actionType,
    pageNumber: input.pageNumber ?? null,
    createdBy: input.createdBy ?? null,
  });

  return {
    ...record,
    databaseConfigured: true,
  };
}

/* ------------------------------------------------------------------
 * Marketing consent management
 * ------------------------------------------------------------------ */

export type EmailSequenceKey = (typeof emailSendSequenceValues)[number];
export type EmailSendStatus = (typeof emailSendStatusValues)[number];

export type EnrollSequenceInput = {
  customerId: string;
  sequence: EmailSequenceKey;
  nextSendAt: Date;
  metadata?: Record<string, unknown> | null;
  resetIfExists?: boolean;
};

/**
 * Enroll a customer in a sequence. Idempotent on (customer, sequence):
 * if already enrolled, no-op unless `resetIfExists` is true.
 */
export async function enrollCustomerInSequence(input: EnrollSequenceInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();

  const existing = await db.query.emailSequenceStates.findFirst({
    where: and(
      eq(emailSequenceStates.customerId, input.customerId),
      eq(emailSequenceStates.sequence, input.sequence),
    ),
  });

  if (existing && !input.resetIfExists) {
    return existing;
  }

  if (existing && input.resetIfExists) {
    await db
      .update(emailSequenceStates)
      .set({
        status: "active",
        currentStep: 0,
        nextSendAt: input.nextSendAt,
        enrolledAt: now(),
        completedAt: null,
        lastSendAt: null,
        metadata: input.metadata ?? null,
      })
      .where(eq(emailSequenceStates.id, existing.id));
    return { ...existing, status: "active" as const, currentStep: 0, nextSendAt: input.nextSendAt, metadata: input.metadata ?? null };
  }

  const record = {
    id: createId("seq"),
    customerId: input.customerId,
    sequence: input.sequence,
    status: "active" as const,
    currentStep: 0,
    nextSendAt: input.nextSendAt,
    enrolledAt: now(),
    completedAt: null as Date | null,
    lastSendAt: null as Date | null,
    metadata: input.metadata ?? null,
  };
  await db.insert(emailSequenceStates).values(record).onConflictDoNothing();
  return record;
}

export async function stopSequenceForCustomer(input: {
  customerId: string;
  sequence: EmailSequenceKey;
  reason: "unsubscribed" | "purchased" | "bounced" | "admin";
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(emailSequenceStates)
    .set({ status: input.reason === "purchased" ? "purchased" : "stopped", completedAt: now() })
    .where(
      and(
        eq(emailSequenceStates.customerId, input.customerId),
        eq(emailSequenceStates.sequence, input.sequence),
      ),
    );
}

export async function stopAllMarketingSequencesForCustomer(customerId: string) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(emailSequenceStates)
    .set({ status: "stopped", completedAt: now() })
    .where(and(eq(emailSequenceStates.customerId, customerId), eq(emailSequenceStates.status, "active")));
}

export type DueSequenceStep = {
  stateId: string;
  customerId: string;
  sequence: EmailSequenceKey;
  currentStep: number;
  nextSendAt: Date;
  customerEmail: string;
  customerFirstName: string | null;
  marketingOptIn: boolean;
  metadata: Record<string, unknown> | null;
};

/**
 * Find up-to `limit` sequence states whose next_send_at is due. Returns
 * the joined customer info so the caller can render + send in one pass.
 */
export async function listDueSequenceSteps(limit = 25): Promise<DueSequenceStep[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const dueNow = now();

  const rows = await db
    .select({
      stateId: emailSequenceStates.id,
      customerId: emailSequenceStates.customerId,
      sequence: emailSequenceStates.sequence,
      currentStep: emailSequenceStates.currentStep,
      nextSendAt: emailSequenceStates.nextSendAt,
      metadata: emailSequenceStates.metadata,
      customerEmail: customers.email,
      customerFirstName: customers.firstName,
      marketingOptIn: customers.marketingOptIn,
    })
    .from(emailSequenceStates)
    .innerJoin(customers, eq(emailSequenceStates.customerId, customers.id))
    .where(
      and(
        eq(emailSequenceStates.status, "active"),
        isNotNull(emailSequenceStates.nextSendAt),
      ),
    )
    .orderBy(emailSequenceStates.nextSendAt)
    .limit(limit);

  return rows
    .filter((r) => r.nextSendAt && r.nextSendAt <= dueNow)
    .map((r) => ({
      stateId: r.stateId,
      customerId: r.customerId,
      sequence: r.sequence as EmailSequenceKey,
      currentStep: r.currentStep,
      nextSendAt: r.nextSendAt!,
      customerEmail: r.customerEmail,
      customerFirstName: r.customerFirstName,
      marketingOptIn: r.marketingOptIn,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    }));
}

export async function advanceSequenceState(input: {
  stateId: string;
  nextStep: number;
  nextSendAt: Date | null;
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(emailSequenceStates)
    .set({
      currentStep: input.nextStep,
      nextSendAt: input.nextSendAt,
      lastSendAt: now(),
      status: input.nextSendAt ? "active" : "completed",
      completedAt: input.nextSendAt ? null : now(),
    })
    .where(eq(emailSequenceStates.id, input.stateId));
}

export async function updateEmailSendStatusByProviderId(input: {
  providerMessageId: string;
  status: EmailSendStatus;
  error?: string | null;
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === "sent") patch.sentAt = now();
  if (input.error) patch.error = input.error;
  await db
    .update(emailSends)
    .set(patch)
    .where(eq(emailSends.providerMessageId, input.providerMessageId));
}

export async function recordSequenceSendAttempt(input: {
  customerId: string;
  orderId?: string | null;
  sequence: EmailSequenceKey;
  step: number;
  template: string;
  toEmail: string;
  subject: string;
  providerMessageId?: string | null;
  status: EmailSendStatus;
  error?: string | null;
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db.insert(emailSends).values({
    id: createId("ems"),
    customerId: input.customerId,
    orderId: input.orderId ?? null,
    sequence: input.sequence,
    step: input.step,
    template: input.template,
    toEmail: input.toEmail,
    subject: input.subject,
    provider: "resend",
    providerMessageId: input.providerMessageId ?? null,
    status: input.status,
    sentAt: input.status === "sent" ? now() : null,
    error: input.error ?? null,
  });
}

export async function findInactiveCustomersSince(input: {
  lastOrderBefore: Date;
  limit?: number;
}) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const limit = input.limit ?? 100;

  // Customers whose most-recent order was before the cutoff AND who are
  // not already enrolled in re_engagement.
  const rows = await db.execute(sql<{
    customer_id: string;
    email: string;
    first_name: string | null;
    last_order_at: Date;
  }>`
    SELECT c.id AS customer_id,
           c.email,
           c.first_name,
           MAX(o.created_at) AS last_order_at
    FROM customers c
    JOIN orders o ON o.customer_id = c.id
    WHERE c.marketing_opt_in = true
      AND NOT EXISTS (
        SELECT 1 FROM email_sequence_states s
        WHERE s.customer_id = c.id AND s.sequence = 're_engagement'
      )
    GROUP BY c.id, c.email, c.first_name
    HAVING MAX(o.created_at) < ${input.lastOrderBefore}
    ORDER BY last_order_at DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as Array<{ customer_id: string; email: string; first_name: string | null; last_order_at: Date }>).map((r) => ({
    customerId: r.customer_id,
    email: r.email,
    firstName: r.first_name,
    lastOrderAt: r.last_order_at,
  }));
}

export type MarketingConsentUpdate = {
  customerId: string;
  marketingOptIn?: boolean;
  featureConsent?: boolean;
};

/**
 * GDPR delete: redact PII from customer-adjacent rows and stop all
 * active sequences. Orders stay (business records), but PII columns
 * are nulled/redacted.
 */
export async function redactCustomerData(customerId: string): Promise<{
  customerId: string;
  redactedRows: Record<string, number>;
}> {
  if (!isDatabaseConfigured()) return { customerId, redactedRows: {} };
  const db = getDatabase();
  const counts: Record<string, number> = {};

  await db
    .update(customers)
    .set({
      email: `redacted-${customerId}@removed.localhost`,
      firstName: null,
      phone: null,
      marketingOptIn: false,
      featureConsent: false,
      resendContactId: null,
      updatedAt: now(),
    })
    .where(eq(customers.id, customerId));
  counts.customer = 1;

  const customerOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.customerId, customerId));
  for (const order of customerOrders) {
    await db
      .update(orderAddresses)
      .set({
        fullName: "REDACTED",
        line1: "REDACTED",
        line2: null,
        city: "REDACTED",
        state: "XX",
        postalCode: "00000",
        phone: null,
      })
      .where(eq(orderAddresses.orderId, order.id));
  }
  counts.order_addresses = customerOrders.length;

  const customerTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.customerId, customerId));
  if (customerTickets.length > 0) {
    await db
      .update(ticketMessages)
      .set({ body: "[redacted by user request]", authorEmail: null })
      .where(
        and(
          eq(ticketMessages.author, "customer"),
          inArray(
            ticketMessages.ticketId,
            customerTickets.map((t) => t.id),
          ),
        ),
      );
  }
  counts.tickets_scrubbed = customerTickets.length;

  await db.delete(emailSequenceStates).where(eq(emailSequenceStates.customerId, customerId));
  counts.sequence_states_removed = 1;

  await db.delete(customerUserLinks).where(eq(customerUserLinks.customerId, customerId));
  counts.user_links_removed = 1;

  return { customerId, redactedRows: counts };
}

export async function updateMarketingConsent(input: MarketingConsentUpdate) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const patch: Record<string, unknown> = { updatedAt: now() };
  if (typeof input.marketingOptIn === "boolean") {
    patch.marketingOptIn = input.marketingOptIn;
  }
  if (typeof input.featureConsent === "boolean") {
    patch.featureConsent = input.featureConsent;
    patch.featureConsentAt = now();
  }
  await db.update(customers).set(patch).where(eq(customers.id, input.customerId));
  const updated = await db.query.customers.findFirst({ where: eq(customers.id, input.customerId) });
  return updated ?? null;
}

/* ------------------------------------------------------------------
 * Ad spend (manual entry for metrics)
 * ------------------------------------------------------------------ */

export type AdSpendPlatform = (typeof adSpendPlatformValues)[number];

export type AdSpendEntry = {
  id: string;
  spendDate: string;
  platform: AdSpendPlatform;
  campaign: string | null;
  amountCents: number;
  currency: string;
  notes: string | null;
  recordedByEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export async function createAdSpendEntry(input: {
  spendDate: string;
  platform: AdSpendPlatform;
  campaign?: string | null;
  amountCents: number;
  currency?: string;
  notes?: string | null;
  recordedByEmail?: string | null;
}): Promise<AdSpendEntry | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const record = {
    id: createId("ads"),
    spendDate: input.spendDate,
    platform: input.platform,
    campaign: input.campaign ?? null,
    amountCents: Math.max(0, Math.floor(input.amountCents)),
    currency: input.currency ?? "USD",
    notes: input.notes ?? null,
    recordedByEmail: input.recordedByEmail ?? null,
    metadata: {},
    createdAt: now(),
  };
  await db.insert(adSpendEntries).values(record);
  return record as AdSpendEntry;
}

export async function listAdSpendEntries(input: {
  limit?: number;
} = {}): Promise<AdSpendEntry[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db
    .select()
    .from(adSpendEntries)
    .orderBy(desc(adSpendEntries.spendDate))
    .limit(input.limit ?? 200);
  return rows as AdSpendEntry[];
}

export async function deleteAdSpendEntry(id: string) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db.delete(adSpendEntries).where(eq(adSpendEntries.id, id));
}

/* ------------------------------------------------------------------
 * Metrics aggregations (dashboard math)
 * ------------------------------------------------------------------ */

export type MetricsWindow = { start: Date; end: Date };

export type MetricsRevenueRow = {
  gross_cents: number;
  refunded_cents: number;
  paid_order_count: number;
  total_order_count: number;
};

export async function getRevenueMetrics(window: MetricsWindow): Promise<MetricsRevenueRow> {
  const fallback: MetricsRevenueRow = { gross_cents: 0, refunded_cents: 0, paid_order_count: 0, total_order_count: 0 };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<MetricsRevenueRow>`
    SELECT
      COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample' THEN total_cents ELSE 0 END), 0)::int AS gross_cents,
      COALESCE(SUM(refunded_cents), 0)::int AS refunded_cents,
      COUNT(*) FILTER (WHERE status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample')::int AS paid_order_count,
      COUNT(*)::int AS total_order_count
    FROM orders
    WHERE created_at >= ${window.start} AND created_at <= ${window.end}
  `);
  const row = (rows as unknown as MetricsRevenueRow[])[0];
  return row ?? fallback;
}

export type MetricsOrderBreakdownRow = {
  pdf_count: number;
  print_count: number;
  sample_count: number;
  refunded_order_count: number;
  awaiting_print_submission: number;
  in_production: number;
  shipped: number;
  delivered: number;
  pending_assembly: number;
};

export async function getOrderBreakdown(window: MetricsWindow): Promise<MetricsOrderBreakdownRow> {
  const fallback: MetricsOrderBreakdownRow = {
    pdf_count: 0,
    print_count: 0,
    sample_count: 0,
    refunded_order_count: 0,
    awaiting_print_submission: 0,
    in_production: 0,
    shipped: 0,
    delivered: 0,
    pending_assembly: 0,
  };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<MetricsOrderBreakdownRow>`
    SELECT
      COUNT(*) FILTER (WHERE delivery_mode = 'pdf' AND order_type != 'sample')::int AS pdf_count,
      COUNT(*) FILTER (WHERE delivery_mode = 'print')::int AS print_count,
      COUNT(*) FILTER (WHERE order_type = 'sample')::int AS sample_count,
      COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_order_count,
      COUNT(*) FILTER (WHERE status = 'awaiting_print_submission')::int AS awaiting_print_submission,
      COUNT(*) FILTER (WHERE status IN ('submitted_to_lulu', 'in_production'))::int AS in_production,
      COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status IN ('preprocessing', 'generating', 'qa_review', 'assembling_pdf'))::int AS pending_assembly
    FROM orders
    WHERE created_at >= ${window.start} AND created_at <= ${window.end}
  `);
  const row = (rows as unknown as MetricsOrderBreakdownRow[])[0];
  return row ?? fallback;
}

export async function getGeminiCostInWindow(window: MetricsWindow): Promise<{
  sample_cost_cents: number;
  paid_cost_cents: number;
  total_cost_cents: number;
}> {
  const fallback = { sample_cost_cents: 0, paid_cost_cents: 0, total_cost_cents: 0 };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<typeof fallback>`
    SELECT
      COALESCE(SUM(CASE WHEN gj.kind = 'sample' THEN gp.cost_cents ELSE 0 END), 0)::int AS sample_cost_cents,
      COALESCE(SUM(CASE WHEN gj.kind = 'full_book' THEN gp.cost_cents ELSE 0 END), 0)::int AS paid_cost_cents,
      COALESCE(SUM(gp.cost_cents), 0)::int AS total_cost_cents
    FROM generation_pages gp
    INNER JOIN generation_jobs gj ON gj.id = gp.generation_job_id
    WHERE gp.created_at >= ${window.start} AND gp.created_at <= ${window.end}
      AND gp.cost_cents IS NOT NULL
  `);
  const row = (rows as unknown as (typeof fallback)[])[0];
  return row ?? fallback;
}

export type DailyMetricsRow = {
  day: string; // YYYY-MM-DD
  revenue_cents: number;
  paid_orders: number;
  samples: number;
};

export async function getDailyRevenueSeries(window: MetricsWindow): Promise<DailyMetricsRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();

  // Prefer pre-aggregated rollup when every day in the window is
  // present. The nightly daily-metrics-rollup cron fills this table;
  // today's row is refreshed on every cron tick. If the rollup is
  // missing any day in the window (e.g. brand-new environment, cron
  // hasn't run yet, or we pushed new migrations), fall through to
  // the live query. This keeps the dashboard correct no matter what.
  const startStr = window.start.toISOString().slice(0, 10);
  const endStr = window.end.toISOString().slice(0, 10);
  const rollupRows = (await db.execute(sql<DailyMetricsRow>`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS day,
      (revenue_cents - refunded_cents)::int AS revenue_cents,
      paid_orders::int,
      samples::int
    FROM daily_metrics_rollup
    WHERE day >= ${startStr}::date AND day <= ${endStr}::date
    ORDER BY day ASC
  `)) as unknown as DailyMetricsRow[];

  const expectedDayCount =
    Math.floor((window.end.getTime() - window.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  // Use rollup only if coverage looks complete (>= 90% of the window).
  // That threshold lets the dashboard keep rendering during a slow
  // rollup backfill without flipping back and forth between paths.
  if (rollupRows.length >= expectedDayCount * 0.9 && rollupRows.length > 0) {
    return rollupRows;
  }

  const rows = await db.execute(sql<DailyMetricsRow>`
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample' THEN total_cents - COALESCE(refunded_cents, 0) ELSE 0 END), 0)::int AS revenue_cents,
      COUNT(*) FILTER (WHERE status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample')::int AS paid_orders,
      COUNT(*) FILTER (WHERE order_type = 'sample')::int AS samples
    FROM orders
    WHERE created_at >= ${window.start} AND created_at <= ${window.end}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows as unknown as DailyMetricsRow[];
}

export async function getLuluActualCostInWindow(window: MetricsWindow): Promise<{
  known_cost_cents: number;
  jobs_with_cost: number;
  jobs_total: number;
}> {
  const fallback = { known_cost_cents: 0, jobs_with_cost: 0, jobs_total: 0 };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<typeof fallback>`
    SELECT
      COALESCE(SUM(fj.cost_cents), 0)::int AS known_cost_cents,
      COUNT(*) FILTER (WHERE fj.cost_cents IS NOT NULL)::int AS jobs_with_cost,
      COUNT(*)::int AS jobs_total
    FROM fulfillment_jobs fj
    INNER JOIN orders o ON o.id = fj.order_id
    WHERE o.created_at >= ${window.start} AND o.created_at <= ${window.end}
      AND fj.status != 'draft'
  `);
  const row = (rows as unknown as (typeof fallback)[])[0];
  return row ?? fallback;
}

/**
 * For print orders in the window that do NOT have a persisted real Lulu
 * cost (no submitted fulfillment_job, or fulfillment_job.cost_cents null),
 * list dimensions so the caller can apply the shared cost formula. When
 * an order has a persisted live shipping quote with a real production
 * cost from Lulu, expose that too so the caller can prefer it over the
 * formula. Used by the metrics dashboard — never exposed to customers.
 */
export async function getUnfulfilledPrintOrderDimensionsInWindow(window: MetricsWindow): Promise<Array<{
  design_count: number;
  quantity: number;
  quoted_production_cost_cents: number | null;
}>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db.execute(sql<{
    design_count: number;
    quantity: number;
    quoted_production_cost_cents: number | null;
  }>`
    WITH best_quote AS (
      SELECT DISTINCT ON (order_id)
        order_id,
        COALESCE(
          (quote_payload->>'productionCostCents')::int,
          ((quote_payload->'line_item_costs'->0->>'total_cost_excl_tax')::numeric * 100)::int
        ) AS production_cost_cents
      FROM shipping_quotes
      WHERE quote_payload IS NOT NULL
      ORDER BY order_id, is_selected DESC, created_at DESC
    )
    SELECT
      o.design_count,
      o.quantity,
      bq.production_cost_cents AS quoted_production_cost_cents
    FROM orders o
    LEFT JOIN fulfillment_jobs fj ON fj.order_id = o.id
    LEFT JOIN best_quote bq ON bq.order_id = o.id
    WHERE o.created_at >= ${window.start} AND o.created_at <= ${window.end}
      AND o.delivery_mode = 'print'
      AND o.status NOT IN ('draft', 'awaiting_payment', 'failed', 'refunded_full')
      AND (fj.id IS NULL OR fj.cost_cents IS NULL OR fj.status = 'draft')
  `);
  return (rows as unknown as Array<{
    design_count: number;
    quantity: number;
    quoted_production_cost_cents: number | null;
  }>).slice();
}

/**
 * Server-only lookup: resolve the real Lulu production cost for an order,
 * preferring the actual captured cost on the fulfillment job, then the
 * live shipping-quote cost from Lulu, then the formula in the caller.
 *
 * Returns null if nothing real is known; caller should apply the shared
 * formula. Never call from a customer-facing response path — Lulu cost
 * is internal cost-of-goods data.
 */
export async function getLuluProductionCostForOrder(orderId: string): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const rows = await db.execute(sql<{ cost_cents: number | null }>`
    SELECT COALESCE(
      (SELECT fj.cost_cents FROM fulfillment_jobs fj WHERE fj.order_id = ${orderId} AND fj.cost_cents IS NOT NULL ORDER BY fj.updated_at DESC LIMIT 1),
      (SELECT COALESCE(
        (sq.quote_payload->>'productionCostCents')::int,
        ((sq.quote_payload->'line_item_costs'->0->>'total_cost_excl_tax')::numeric * 100)::int
      ) FROM shipping_quotes sq WHERE sq.order_id = ${orderId} AND sq.quote_payload IS NOT NULL ORDER BY sq.is_selected DESC, sq.created_at DESC LIMIT 1)
    )::int AS cost_cents
  `);
  const row = (rows as unknown as Array<{ cost_cents: number | null }>)[0];
  const v = row?.cost_cents;
  return typeof v === "number" && v > 0 ? v : null;
}

/* ------------------------------------------------------------------
 * Daily metrics rollup (nightly pre-aggregation)
 * ------------------------------------------------------------------ */

export type DailyRollupRow = {
  day: string;
  revenue_cents: number;
  refunded_cents: number;
  paid_orders: number;
  pdf_orders: number;
  print_orders: number;
  samples: number;
  new_paying_customers: number;
  gemini_cost_cents: number;
  lulu_cost_cents: number;
  ad_spend_cents: number;
};

export async function recomputeDailyRollup(dayIso: string): Promise<DailyRollupRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const rows = await db.execute(sql<DailyRollupRow>`
    WITH day_bounds AS (
      SELECT
        ${dayIso}::date AS d,
        (${dayIso}::date)::timestamptz AS start_ts,
        ((${dayIso}::date) + INTERVAL '1 day')::timestamptz AS end_ts
    ),
    order_agg AS (
      SELECT
        COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample' THEN total_cents ELSE 0 END), 0)::int AS revenue_cents,
        COALESCE(SUM(refunded_cents), 0)::int AS refunded_cents,
        COUNT(*) FILTER (WHERE status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample')::int AS paid_orders,
        COUNT(*) FILTER (WHERE delivery_mode = 'pdf' AND order_type != 'sample')::int AS pdf_orders,
        COUNT(*) FILTER (WHERE delivery_mode = 'print')::int AS print_orders,
        COUNT(*) FILTER (WHERE order_type = 'sample')::int AS samples
      FROM orders, day_bounds
      WHERE created_at >= start_ts AND created_at < end_ts
    ),
    first_paid_day AS (
      SELECT MIN(created_at) AS first_at
      FROM orders
      WHERE status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND order_type != 'sample'
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    ),
    new_paying AS (
      SELECT COUNT(*)::int AS c
      FROM first_paid_day, day_bounds
      WHERE first_at >= start_ts AND first_at < end_ts
    ),
    gemini_agg AS (
      SELECT COALESCE(SUM(cost_cents), 0)::int AS c
      FROM generation_pages, day_bounds
      WHERE created_at >= start_ts AND created_at < end_ts
        AND cost_cents IS NOT NULL
    ),
    lulu_agg AS (
      SELECT COALESCE(SUM(fj.cost_cents), 0)::int AS c
      FROM fulfillment_jobs fj, day_bounds
      WHERE fj.updated_at >= start_ts AND fj.updated_at < end_ts
        AND fj.cost_cents IS NOT NULL
    ),
    ad_agg AS (
      SELECT COALESCE(SUM(amount_cents), 0)::int AS c
      FROM ad_spend_entries, day_bounds
      WHERE spend_date = d
    )
    SELECT
      to_char(d, 'YYYY-MM-DD') AS day,
      oa.revenue_cents,
      oa.refunded_cents,
      oa.paid_orders,
      oa.pdf_orders,
      oa.print_orders,
      oa.samples,
      np.c AS new_paying_customers,
      ga.c AS gemini_cost_cents,
      la.c AS lulu_cost_cents,
      ada.c AS ad_spend_cents
    FROM day_bounds db2
    CROSS JOIN order_agg oa
    CROSS JOIN new_paying np
    CROSS JOIN gemini_agg ga
    CROSS JOIN lulu_agg la
    CROSS JOIN ad_agg ada
  `);

  const row = (rows as unknown as DailyRollupRow[])[0];
  if (!row) return null;

  // Upsert into daily_metrics_rollup.
  await db.execute(sql`
    INSERT INTO daily_metrics_rollup (
      day, revenue_cents, refunded_cents, paid_orders, pdf_orders, print_orders,
      samples, new_paying_customers, gemini_cost_cents, lulu_cost_cents, ad_spend_cents,
      recomputed_at
    ) VALUES (
      ${dayIso}::date, ${row.revenue_cents}, ${row.refunded_cents}, ${row.paid_orders},
      ${row.pdf_orders}, ${row.print_orders}, ${row.samples}, ${row.new_paying_customers},
      ${row.gemini_cost_cents}, ${row.lulu_cost_cents}, ${row.ad_spend_cents}, NOW()
    )
    ON CONFLICT (day) DO UPDATE SET
      revenue_cents = EXCLUDED.revenue_cents,
      refunded_cents = EXCLUDED.refunded_cents,
      paid_orders = EXCLUDED.paid_orders,
      pdf_orders = EXCLUDED.pdf_orders,
      print_orders = EXCLUDED.print_orders,
      samples = EXCLUDED.samples,
      new_paying_customers = EXCLUDED.new_paying_customers,
      gemini_cost_cents = EXCLUDED.gemini_cost_cents,
      lulu_cost_cents = EXCLUDED.lulu_cost_cents,
      ad_spend_cents = EXCLUDED.ad_spend_cents,
      recomputed_at = NOW()
  `);

  return row;
}

/* ------------------------------------------------------------------
 * Meta Growth System — CAPI + API call repositories
 * ------------------------------------------------------------------ */

export type InsertCapiEventInput = {
  id: string;
  eventId: string;
  eventName: string;
  eventTime: Date;
  actionSource: string;
  userDataFingerprint: string;
  payloadJson: Record<string, unknown>;
};

export async function insertCapiEvent(input: InsertCapiEventInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const record = {
    ...input,
    status: "queued" as const,
    metaEventsReceived: null as number | null,
    metaTraceId: null as string | null,
    errorMessage: null as string | null,
    retryCount: 0,
    sentAt: null as Date | null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(capiEvents).values(record);
  return record;
}

export async function getCapiEventById(id: string) {
  if (!isDatabaseConfigured()) return null;
  return getDatabase().query.capiEvents.findFirst({
    where: eq(capiEvents.id, id),
  });
}

export async function getCapiEventByEventId(eventId: string) {
  if (!isDatabaseConfigured()) return null;
  return getDatabase().query.capiEvents.findFirst({
    where: eq(capiEvents.eventId, eventId),
  });
}

export async function updateCapiEventStatus(
  id: string,
  update: {
    status: CapiEventStatus;
    metaEventsReceived?: number | null;
    metaTraceId?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    sentAt?: Date | null;
  },
) {
  if (!isDatabaseConfigured()) return;
  await getDatabase()
    .update(capiEvents)
    .set({
      status: update.status,
      metaEventsReceived: update.metaEventsReceived ?? null,
      metaTraceId: update.metaTraceId ?? null,
      errorMessage: update.errorMessage ?? null,
      retryCount: update.retryCount,
      sentAt: update.sentAt ?? null,
      updatedAt: now(),
    })
    .where(eq(capiEvents.id, id));
}

export type RecordMetaApiCallInput = {
  id: string;
  method: string;
  endpoint: string;
  payloadHash?: string | null;
  responseStatus?: number | null;
  responseExcerpt?: string | null;
  bucUsagePercent?: number | null;
  durationMs?: number | null;
  errorCode?: number | null;
  errorSubcode?: number | null;
};

export async function recordMetaApiCall(input: RecordMetaApiCallInput) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db.insert(metaApiCalls).values({
    id: input.id,
    method: input.method,
    endpoint: input.endpoint,
    payloadHash: input.payloadHash ?? null,
    responseStatus: input.responseStatus ?? null,
    responseExcerpt: input.responseExcerpt ?? null,
    bucUsagePercent: input.bucUsagePercent ?? null,
    durationMs: input.durationMs ?? null,
    errorCode: input.errorCode ?? null,
    errorSubcode: input.errorSubcode ?? null,
    createdAt: now(),
  });
}

export async function listRecentMetaApiCalls(limit = 100) {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(metaApiCalls)
    .orderBy(desc(metaApiCalls.createdAt))
    .limit(limit);
}

export async function listDailyRollup(days = 90): Promise<DailyRollupRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db.execute(sql<DailyRollupRow>`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS day,
      revenue_cents, refunded_cents, paid_orders, pdf_orders, print_orders,
      samples, new_paying_customers, gemini_cost_cents, lulu_cost_cents, ad_spend_cents
    FROM daily_metrics_rollup
    WHERE day >= (CURRENT_DATE - (${days}::int * INTERVAL '1 day'))
    ORDER BY day ASC
  `);
  return rows as unknown as DailyRollupRow[];
}

/* ------------------------------------------------------------------
 * UTM attribution report
 * ------------------------------------------------------------------ */

export type AttributionRow = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  acquisition_path: string;
  samples: number;
  paid_orders: number;
  revenue_cents: number;
  refunded_cents: number;
  unique_customers: number;
};

export async function getUtmAttributionReport(window: MetricsWindow): Promise<AttributionRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db.execute(sql<AttributionRow>`
    SELECT
      COALESCE(utm_source, '(none)') AS utm_source,
      COALESCE(utm_medium, '(none)') AS utm_medium,
      COALESCE(utm_campaign, '(none)') AS utm_campaign,
      COALESCE(acquisition_path, 'unknown') AS acquisition_path,
      COUNT(*) FILTER (WHERE order_type = 'sample')::int AS samples,
      COUNT(*) FILTER (WHERE status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample')::int AS paid_orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample' THEN total_cents ELSE 0 END), 0)::int AS revenue_cents,
      COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'awaiting_payment', 'failed') AND order_type != 'sample' THEN COALESCE(refunded_cents, 0) ELSE 0 END), 0)::int AS refunded_cents,
      COUNT(DISTINCT customer_id)::int AS unique_customers
    FROM orders
    WHERE created_at >= ${window.start} AND created_at <= ${window.end}
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 0
    ORDER BY paid_orders DESC, samples DESC
  `);
  return rows as unknown as AttributionRow[];
}

export async function sumAdSpendInWindow(window: MetricsWindow): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDatabase();
  const startStr = window.start.toISOString().slice(0, 10);
  const endStr = window.end.toISOString().slice(0, 10);
  const rows = await db.execute(sql<{ total_cents: number }>`
    SELECT COALESCE(SUM(amount_cents), 0)::int AS total_cents
    FROM ad_spend_entries
    WHERE spend_date >= ${startStr} AND spend_date <= ${endStr}
  `);
  return (rows as unknown as Array<{ total_cents: number }>)[0]?.total_cents ?? 0;
}

export async function getSampleToPaidFunnel(window: MetricsWindow): Promise<{
  samples_created: number;
  samples_to_paid: number;
}> {
  const fallback = { samples_created: 0, samples_to_paid: 0 };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<typeof fallback>`
    WITH samples AS (
      SELECT customer_id, MIN(created_at) AS sample_at
      FROM orders
      WHERE order_type = 'sample' AND created_at >= ${window.start} AND created_at <= ${window.end}
      GROUP BY customer_id
    ),
    conversions AS (
      SELECT s.customer_id
      FROM samples s
      INNER JOIN orders o ON o.customer_id = s.customer_id
      WHERE o.order_type != 'sample'
        AND o.status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND o.created_at >= s.sample_at
    )
    SELECT
      (SELECT COUNT(*)::int FROM samples) AS samples_created,
      (SELECT COUNT(DISTINCT customer_id)::int FROM conversions) AS samples_to_paid
  `);
  const row = (rows as unknown as (typeof fallback)[])[0];
  return row ?? fallback;
}

export async function getRepeatCustomerStats(window: MetricsWindow): Promise<{
  paying_customers: number;
  repeat_customers: number;
  total_paid_revenue_cents: number;
}> {
  const fallback = { paying_customers: 0, repeat_customers: 0, total_paid_revenue_cents: 0 };
  if (!isDatabaseConfigured()) return fallback;
  const db = getDatabase();
  const rows = await db.execute(sql<typeof fallback>`
    WITH paid_orders AS (
      SELECT customer_id, total_cents - COALESCE(refunded_cents, 0) AS net_cents
      FROM orders
      WHERE order_type != 'sample'
        AND status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND customer_id IS NOT NULL
        AND created_at >= ${window.start} AND created_at <= ${window.end}
    )
    SELECT
      (SELECT COUNT(DISTINCT customer_id)::int FROM paid_orders) AS paying_customers,
      (SELECT COUNT(*)::int FROM (
         SELECT customer_id FROM paid_orders GROUP BY customer_id HAVING COUNT(*) >= 2
       ) AS rc) AS repeat_customers,
      COALESCE((SELECT SUM(net_cents)::int FROM paid_orders), 0) AS total_paid_revenue_cents
  `);
  const row = (rows as unknown as (typeof fallback)[])[0];
  return row ?? fallback;
}

/* ------------------------------------------------------------------
 * Organic Social Publishing — Phase 3a
 * ------------------------------------------------------------------ */

export type InsertOrganicPostInput = {
  id: string;
  platform: OrganicPostPlatform;
  format: OrganicPostFormat;
  caption: string;
  firstComment?: string | null;
  imageAssetIds?: string[];
  scheduledAt?: Date | null;
  createdBy?: string | null;
};

export async function insertOrganicPost(input: InsertOrganicPostInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const status: OrganicPostStatus = input.scheduledAt ? "scheduled" : "draft";
  const [row] = await db
    .insert(organicPosts)
    .values({
      id: input.id,
      platform: input.platform,
      format: input.format,
      status,
      caption: input.caption,
      firstComment: input.firstComment ?? null,
      imageAssetIds: input.imageAssetIds ?? [],
      scheduledAt: input.scheduledAt ?? null,
      publishingAttempts: 0,
      publishedAt: null,
      metaFbPostId: null,
      metaIgPostId: null,
      errorMessage: null,
      createdBy: input.createdBy ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return row ?? null;
}

export type UpdateOrganicPostStatusPatch = {
  metaFbPostId?: string | null;
  metaIgPostId?: string | null;
  publishedAt?: Date | null;
  errorMessage?: string | null;
  publishingAttempts?: number;
  scheduledAt?: Date | null;
};

export async function updateOrganicPostStatus(
  id: string,
  status: OrganicPostStatus,
  patch?: UpdateOrganicPostStatusPatch,
) {
  if (!isDatabaseConfigured()) return;
  await getDatabase()
    .update(organicPosts)
    .set({
      status,
      ...(patch?.metaFbPostId !== undefined ? { metaFbPostId: patch.metaFbPostId } : {}),
      ...(patch?.metaIgPostId !== undefined ? { metaIgPostId: patch.metaIgPostId } : {}),
      ...(patch?.publishedAt !== undefined ? { publishedAt: patch.publishedAt } : {}),
      ...(patch?.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch?.publishingAttempts !== undefined ? { publishingAttempts: patch.publishingAttempts } : {}),
      ...(patch?.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
      updatedAt: now(),
    })
    .where(eq(organicPosts.id, id));
}

export async function listDueOrganicPosts({ nowUnix, limit = 10 }: { nowUnix: number; limit?: number }) {
  if (!isDatabaseConfigured()) return [];
  const cutoff = new Date(nowUnix * 1000);
  return getDatabase()
    .select()
    .from(organicPosts)
    .where(
      and(
        eq(organicPosts.status, "scheduled"),
        sql`${organicPosts.scheduledAt} <= ${cutoff}`,
      ),
    )
    .orderBy(organicPosts.scheduledAt)
    .limit(limit);
}

export async function getOrganicPostById(id: string) {
  if (!isDatabaseConfigured()) return null;
  return (
    getDatabase().query.organicPosts.findFirst({
      where: eq(organicPosts.id, id),
    }) ?? null
  );
}

export async function listOrganicPosts({
  status,
  platform,
  limit = 50,
  offset = 0,
}: {
  status?: OrganicPostStatus;
  platform?: OrganicPostPlatform;
  limit?: number;
  offset?: number;
}) {
  if (!isDatabaseConfigured()) return [];
  const conditions = [
    ...(status ? [eq(organicPosts.status, status)] : []),
    ...(platform ? [eq(organicPosts.platform, platform)] : []),
  ];
  return getDatabase()
    .select()
    .from(organicPosts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(organicPosts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function cancelOrganicPost(id: string) {
  if (!isDatabaseConfigured()) return;
  await getDatabase()
    .update(organicPosts)
    .set({ status: "canceled", updatedAt: now() })
    .where(
      and(
        eq(organicPosts.id, id),
        sql`${organicPosts.status} NOT IN ('published', 'publishing')`,
      ),
    );
}

export type RecordOrganicPostMetricInput = {
  id: string;
  organicPostId: string;
  platform: OrganicPostPlatform;
  observedAt: Date;
  impressions?: number;
  reach?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  engagementRate?: string | null;
};

export async function recordOrganicPostMetricSnapshot(input: RecordOrganicPostMetricInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(organicPostMetrics)
    .values({
      id: input.id,
      organicPostId: input.organicPostId,
      observedAt: input.observedAt,
      platform: input.platform,
      impressions: input.impressions ?? 0,
      reach: input.reach ?? 0,
      reactions: input.reactions ?? 0,
      comments: input.comments ?? 0,
      shares: input.shares ?? 0,
      clicks: input.clicks ?? 0,
      engagementRate: input.engagementRate ?? null,
      createdAt: now(),
    })
    .returning();
  return row ?? null;
}


export async function countNewPayingCustomers(window: MetricsWindow): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDatabase();
  const rows = await db.execute(sql<{ count: number }>`
    WITH first_paid AS (
      SELECT customer_id, MIN(created_at) AS first_at
      FROM orders
      WHERE order_type != 'sample'
        AND status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    )
    SELECT COUNT(*)::int AS count FROM first_paid
    WHERE first_at >= ${window.start} AND first_at <= ${window.end}
  `);
  return (rows as unknown as Array<{ count: number }>)[0]?.count ?? 0;
}

/* ------------------------------------------------------------------
 * Cohort analysis (12-month LTV by acquisition month)
 * ------------------------------------------------------------------ */

export type CohortCell = {
  cohort_month: string;   // YYYY-MM-01
  months_since: number;
  net_cents: number;
  active_customers: number;
};

export type CohortSize = {
  cohort_month: string;
  customer_count: number;
};

/**
 * Revenue contribution per (acquisition-month cohort, months-since
 * first purchase). Goes back 24 months; only months-since 0..11 are
 * returned (one year of data per cohort). The caller pivots this
 * into a table for display.
 */
export async function getCohortRevenueMatrix(
  maxMonthsSince = 11,
  lookbackMonths = 24,
): Promise<{ cells: CohortCell[]; sizes: CohortSize[] }> {
  if (!isDatabaseConfigured()) return { cells: [], sizes: [] };
  const db = getDatabase();

  const cellsRaw = await db.execute(sql<CohortCell>`
    WITH first_paid AS (
      SELECT
        customer_id,
        MIN(created_at) AS first_at,
        date_trunc('month', MIN(created_at) AT TIME ZONE 'UTC') AS cohort_month
      FROM orders
      WHERE status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND order_type != 'sample'
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    ),
    recent_cohorts AS (
      SELECT * FROM first_paid
      WHERE cohort_month >= date_trunc('month', NOW() AT TIME ZONE 'UTC') - (${lookbackMonths}::int * INTERVAL '1 month')
    )
    SELECT
      to_char(rc.cohort_month, 'YYYY-MM-DD') AS cohort_month,
      (
        EXTRACT(YEAR FROM AGE(date_trunc('month', o.created_at AT TIME ZONE 'UTC'), rc.cohort_month))::int * 12
        + EXTRACT(MONTH FROM AGE(date_trunc('month', o.created_at AT TIME ZONE 'UTC'), rc.cohort_month))::int
      )::int AS months_since,
      COALESCE(SUM(o.total_cents - COALESCE(o.refunded_cents, 0))::int, 0) AS net_cents,
      COUNT(DISTINCT o.customer_id)::int AS active_customers
    FROM recent_cohorts rc
    INNER JOIN orders o ON o.customer_id = rc.customer_id
    WHERE o.status NOT IN ('draft', 'awaiting_payment', 'failed')
      AND o.order_type != 'sample'
    GROUP BY rc.cohort_month, months_since
    HAVING (
        EXTRACT(YEAR FROM AGE(date_trunc('month', o.created_at AT TIME ZONE 'UTC'), rc.cohort_month))::int * 12
        + EXTRACT(MONTH FROM AGE(date_trunc('month', o.created_at AT TIME ZONE 'UTC'), rc.cohort_month))::int
      ) <= ${maxMonthsSince}
    ORDER BY rc.cohort_month DESC, months_since ASC
  `);

  const sizesRaw = await db.execute(sql<CohortSize>`
    WITH first_paid AS (
      SELECT
        customer_id,
        date_trunc('month', MIN(created_at) AT TIME ZONE 'UTC') AS cohort_month
      FROM orders
      WHERE status NOT IN ('draft', 'awaiting_payment', 'failed')
        AND order_type != 'sample'
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    )
    SELECT to_char(cohort_month, 'YYYY-MM-DD') AS cohort_month, COUNT(*)::int AS customer_count
    FROM first_paid
    WHERE cohort_month >= date_trunc('month', NOW() AT TIME ZONE 'UTC') - (${lookbackMonths}::int * INTERVAL '1 month')
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
  `);

  return {
    cells: cellsRaw as unknown as CohortCell[],
    sizes: sizesRaw as unknown as CohortSize[],
  };
}

/* ------------------------------------------------------------------
 * Refunds (Phase 3)
 * ------------------------------------------------------------------ */

export type RefundStatus = (typeof refundStatusValues)[number];
export type RefundReason = (typeof refundReasonValues)[number];
export type RefundPolicyTier = (typeof refundPolicyTierValues)[number];

export type RefundRow = {
  id: string;
  orderId: string;
  ticketId: string | null;
  status: RefundStatus;
  reason: RefundReason;
  amountCents: number;
  refundedCents: number | null;
  stripeRefundId: string | null;
  stripeError: Record<string, unknown> | null;
  requestedByEmail: string | null;
  approvedByEmail: string | null;
  policyTier: RefundPolicyTier;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export async function createRefundRequest(input: {
  orderId: string;
  ticketId?: string | null;
  reason: RefundReason;
  amountCents: number;
  policyTier: RefundPolicyTier;
  requestedByEmail?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  initialStatus?: RefundStatus;
}): Promise<RefundRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const record = {
    id: createId("ref"),
    orderId: input.orderId,
    ticketId: input.ticketId ?? null,
    status: (input.initialStatus ?? "requested") as RefundStatus,
    reason: input.reason,
    amountCents: Math.max(0, Math.floor(input.amountCents)),
    refundedCents: null as number | null,
    stripeRefundId: null as string | null,
    stripeError: null as Record<string, unknown> | null,
    requestedByEmail: input.requestedByEmail ?? null,
    approvedByEmail: null as string | null,
    policyTier: input.policyTier,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(refunds).values(record);
  return record as RefundRow;
}

export async function listRefundsForOrder(orderId: string): Promise<RefundRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db.select().from(refunds).where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.createdAt));
  return rows as RefundRow[];
}

export async function listAdminRefundQueue(limit = 50): Promise<RefundRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db
    .select()
    .from(refunds)
    .where(inArray(refunds.status, ["requested", "approved", "processing"]))
    .orderBy(refunds.createdAt)
    .limit(limit);
  return rows as RefundRow[];
}

export async function getRefundById(id: string): Promise<RefundRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.refunds.findFirst({ where: eq(refunds.id, id) });
  return (row as RefundRow) ?? null;
}

export async function updateRefundStatus(input: {
  id: string;
  status: RefundStatus;
  stripeRefundId?: string | null;
  refundedCents?: number | null;
  stripeError?: Record<string, unknown> | null;
  approvedByEmail?: string | null;
  notes?: string | null;
}): Promise<RefundRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const patch: Record<string, unknown> = { status: input.status, updatedAt: now() };
  if (input.stripeRefundId !== undefined) patch.stripeRefundId = input.stripeRefundId;
  if (input.refundedCents !== undefined) patch.refundedCents = input.refundedCents;
  if (input.stripeError !== undefined) patch.stripeError = input.stripeError;
  if (input.approvedByEmail !== undefined) patch.approvedByEmail = input.approvedByEmail;
  if (input.notes !== undefined) patch.notes = input.notes;
  await db.update(refunds).set(patch).where(eq(refunds.id, input.id));
  const row = await db.query.refunds.findFirst({ where: eq(refunds.id, input.id) });
  return (row as RefundRow) ?? null;
}

export async function incrementOrderRefundedCents(input: {
  orderId: string;
  addCents: number;
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(orders)
    .set({
      refundedCents: sql`${orders.refundedCents} + ${input.addCents}`,
      updatedAt: now(),
    })
    .where(eq(orders.id, input.orderId));
}

export async function findRefundByStripeRefundId(stripeRefundId: string): Promise<RefundRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.refunds.findFirst({
    where: eq(refunds.stripeRefundId, stripeRefundId),
  });
  return (row as RefundRow) ?? null;
}

/* ------------------------------------------------------------------
 * Tickets (Phase 2)
 * ------------------------------------------------------------------ */

export type TicketCategory = (typeof ticketCategoryValues)[number];
export type TicketStatus = (typeof ticketStatusValues)[number];
export type TicketPriority = (typeof ticketPriorityValues)[number];
export type TicketAuthor = (typeof ticketAuthorValues)[number];

const FIRST_RESPONSE_SLA_MS = 24 * 60 * 60 * 1000;

export type TicketRow = {
  id: string;
  customerId: string;
  orderId: string | null;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  summary: string | null;
  assignedAdminEmail: string | null;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketMessageRow = {
  id: string;
  ticketId: string;
  author: TicketAuthor;
  authorEmail: string | null;
  body: string;
  internal: boolean;
  attachments: Array<Record<string, unknown>>;
  createdAt: Date;
};

export type OpenTicketInput = {
  customerId: string;
  orderId?: string | null;
  category: TicketCategory;
  subject: string;
  body: string;
  customerEmail?: string | null;
  priority?: TicketPriority;
  metadata?: Record<string, unknown>;
};

export async function openTicket(input: OpenTicketInput): Promise<{
  ticket: TicketRow;
  firstMessage: TicketMessageRow;
} | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getDatabase();
  const createdAt = now();
  const ticketRow = {
    id: createId("tkt"),
    customerId: input.customerId,
    orderId: input.orderId ?? null,
    category: input.category,
    status: "open" as TicketStatus,
    priority: input.priority ?? "normal",
    subject: input.subject.trim().slice(0, 240),
    summary: input.body.trim().slice(0, 400),
    assignedAdminEmail: null,
    firstResponseDueAt: new Date(createdAt.getTime() + FIRST_RESPONSE_SLA_MS),
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    metadata: input.metadata ?? {},
    createdAt,
    updatedAt: createdAt,
  };
  await db.insert(tickets).values(ticketRow);

  const messageRow = {
    id: createId("tmsg"),
    ticketId: ticketRow.id,
    author: "customer" as TicketAuthor,
    authorEmail: input.customerEmail ?? null,
    body: input.body,
    internal: false,
    attachments: [] as Array<Record<string, unknown>>,
    createdAt,
  };
  await db.insert(ticketMessages).values(messageRow);

  return { ticket: ticketRow as TicketRow, firstMessage: messageRow as TicketMessageRow };
}

export async function listTicketsForCustomer(customerId: string, limit = 50): Promise<TicketRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.customerId, customerId))
    .orderBy(desc(tickets.createdAt))
    .limit(limit);
  return rows as TicketRow[];
}

export async function getTicketForCustomer(input: {
  ticketId: string;
  customerId: string;
}): Promise<{ ticket: TicketRow; messages: TicketMessageRow[] } | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, input.ticketId), eq(tickets.customerId, input.customerId)),
  });
  if (!ticket) return null;

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(and(eq(ticketMessages.ticketId, ticket.id), eq(ticketMessages.internal, false)))
    .orderBy(ticketMessages.createdAt);

  return { ticket: ticket as TicketRow, messages: messages as TicketMessageRow[] };
}

export async function addTicketMessage(input: {
  ticketId: string;
  author: TicketAuthor;
  authorEmail?: string | null;
  body: string;
  internal?: boolean;
  attachments?: Array<Record<string, unknown>>;
}): Promise<TicketMessageRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const createdAt = now();
  const row = {
    id: createId("tmsg"),
    ticketId: input.ticketId,
    author: input.author,
    authorEmail: input.authorEmail ?? null,
    body: input.body,
    internal: input.internal ?? false,
    attachments: input.attachments ?? [],
    createdAt,
  };
  await db.insert(ticketMessages).values(row);

  const patch: Record<string, unknown> = { updatedAt: createdAt };
  if (input.author === "admin" && !input.internal) {
    patch.firstRespondedAt = sql`COALESCE(${tickets.firstRespondedAt}, ${createdAt})`;
    patch.status = "awaiting_customer";
  } else if (input.author === "customer") {
    patch.status = "open";
  }
  await db.update(tickets).set(patch).where(eq(tickets.id, input.ticketId));

  return row as TicketMessageRow;
}

export async function setTicketStatus(input: {
  ticketId: string;
  status: TicketStatus;
  actorEmail?: string | null;
}): Promise<TicketRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const nowDate = now();
  const patch: Record<string, unknown> = { status: input.status, updatedAt: nowDate };
  if (input.status === "resolved") patch.resolvedAt = nowDate;
  if (input.status === "closed") patch.closedAt = nowDate;
  await db.update(tickets).set(patch).where(eq(tickets.id, input.ticketId));

  const row = await db.query.tickets.findFirst({ where: eq(tickets.id, input.ticketId) });
  return (row as TicketRow) ?? null;
}

export async function assignTicket(input: {
  ticketId: string;
  assignedAdminEmail: string;
}): Promise<TicketRow | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  await db
    .update(tickets)
    .set({ assignedAdminEmail: input.assignedAdminEmail, updatedAt: now() })
    .where(eq(tickets.id, input.ticketId));
  const row = await db.query.tickets.findFirst({ where: eq(tickets.id, input.ticketId) });
  return (row as TicketRow) ?? null;
}

export type AdminTicketRow = TicketRow & {
  customerEmail: string;
  customerFirstName: string | null;
};

export async function listAdminTicketInbox(
  filter: { status?: TicketStatus; limit?: number } = {},
): Promise<AdminTicketRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const limit = filter.limit ?? 100;

  const whereClause = filter.status
    ? eq(tickets.status, filter.status)
    : inArray(tickets.status, ["open", "awaiting_customer", "in_progress"]);

  const rows = await db
    .select({
      id: tickets.id,
      customerId: tickets.customerId,
      orderId: tickets.orderId,
      category: tickets.category,
      status: tickets.status,
      priority: tickets.priority,
      subject: tickets.subject,
      summary: tickets.summary,
      assignedAdminEmail: tickets.assignedAdminEmail,
      firstResponseDueAt: tickets.firstResponseDueAt,
      firstRespondedAt: tickets.firstRespondedAt,
      resolvedAt: tickets.resolvedAt,
      closedAt: tickets.closedAt,
      metadata: tickets.metadata,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      customerEmail: customers.email,
      customerFirstName: customers.firstName,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(whereClause)
    .orderBy(tickets.firstResponseDueAt)
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  })) as AdminTicketRow[];
}

export async function getAdminTicketDetail(ticketId: string): Promise<
  { ticket: AdminTicketRow; messages: TicketMessageRow[] } | null
> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();

  const joined = await db
    .select({
      id: tickets.id,
      customerId: tickets.customerId,
      orderId: tickets.orderId,
      category: tickets.category,
      status: tickets.status,
      priority: tickets.priority,
      subject: tickets.subject,
      summary: tickets.summary,
      assignedAdminEmail: tickets.assignedAdminEmail,
      firstResponseDueAt: tickets.firstResponseDueAt,
      firstRespondedAt: tickets.firstRespondedAt,
      resolvedAt: tickets.resolvedAt,
      closedAt: tickets.closedAt,
      metadata: tickets.metadata,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      customerEmail: customers.email,
      customerFirstName: customers.firstName,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  const row = joined[0];
  if (!row) return null;

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt);

  return {
    ticket: { ...row, metadata: (row.metadata as Record<string, unknown>) ?? {} } as AdminTicketRow,
    messages: messages as TicketMessageRow[],
  };
}

export async function listSlaBreachedTickets(limit = 50): Promise<AdminTicketRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const currentTime = now();

  const rows = await db
    .select({
      id: tickets.id,
      customerId: tickets.customerId,
      orderId: tickets.orderId,
      category: tickets.category,
      status: tickets.status,
      priority: tickets.priority,
      subject: tickets.subject,
      summary: tickets.summary,
      assignedAdminEmail: tickets.assignedAdminEmail,
      firstResponseDueAt: tickets.firstResponseDueAt,
      firstRespondedAt: tickets.firstRespondedAt,
      resolvedAt: tickets.resolvedAt,
      closedAt: tickets.closedAt,
      metadata: tickets.metadata,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      customerEmail: customers.email,
      customerFirstName: customers.firstName,
    })
    .from(tickets)
    .innerJoin(customers, eq(tickets.customerId, customers.id))
    .where(
      and(
        inArray(tickets.status, ["open", "in_progress"]),
        isNotNull(tickets.firstResponseDueAt),
      ),
    )
    .limit(limit);

  return rows
    .filter(
      (r) =>
        r.firstResponseDueAt &&
        r.firstResponseDueAt <= currentTime &&
        !r.firstRespondedAt &&
        !(r.metadata as Record<string, unknown>)?.sla_breach_notified_at,
    )
    .map((r) => ({
      ...r,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    })) as AdminTicketRow[];
}

export async function markTicketSlaBreachNotified(ticketId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  const current = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!current) return;
  const meta = (current.metadata as Record<string, unknown>) ?? {};
  meta.sla_breach_notified_at = now().toISOString();
  await db.update(tickets).set({ metadata: meta, updatedAt: now() }).where(eq(tickets.id, ticketId));
}

/* ------------------------------------------------------------------
 * Broadcast review + control (admin preview workflow)
 * ------------------------------------------------------------------ */

export async function listRecentBroadcasts(limit = 25) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db
    .select()
    .from(broadcastSends)
    .orderBy(desc(broadcastSends.createdAt))
    .limit(limit);
  return rows;
}

export async function getBroadcastById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.broadcastSends.findFirst({
    where: eq(broadcastSends.id, id),
  });
  return row ?? null;
}

export async function markBroadcastStatus(input: {
  id: string;
  status: "drafted" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  error?: string | null;
}) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(broadcastSends)
    .set({
      status: input.status,
      error: input.error ?? null,
      updatedAt: now(),
      sentAt: input.status === "sent" ? now() : undefined,
    })
    .where(eq(broadcastSends.id, input.id));
}

/* ------------------------------------------------------------------
 * Customer <-> Stack user linking (Phase 1 of accounts/tickets/refunds)
 * ------------------------------------------------------------------ */

export type CustomerUserLinkSource = "post_purchase" | "self_signup" | "admin_link";

export type CustomerUserLink = {
  id: string;
  stackUserId: string;
  customerId: string;
  source: string;
  linkedAt: Date;
};

export async function findCustomerUserLinkByStackUserId(stackUserId: string): Promise<CustomerUserLink | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = getDatabase();
  const link = await db.query.customerUserLinks.findFirst({
    where: eq(customerUserLinks.stackUserId, stackUserId),
  });

  return link ?? null;
}

export async function findCustomerUserLinkByCustomerId(customerId: string): Promise<CustomerUserLink | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = getDatabase();
  const link = await db.query.customerUserLinks.findFirst({
    where: eq(customerUserLinks.customerId, customerId),
  });

  return link ?? null;
}

export async function createCustomerUserLink(input: {
  stackUserId: string;
  customerId: string;
  source?: CustomerUserLinkSource;
}): Promise<CustomerUserLink> {
  const record = {
    id: createId("cul"),
    stackUserId: input.stackUserId,
    customerId: input.customerId,
    source: input.source ?? "post_purchase",
    linkedAt: now(),
  };

  if (!isDatabaseConfigured()) {
    return record;
  }

  const db = getDatabase();
  const existing = await db.query.customerUserLinks.findFirst({
    where: eq(customerUserLinks.stackUserId, input.stackUserId),
  });

  if (existing) {
    return existing;
  }

  await db.insert(customerUserLinks).values(record).onConflictDoNothing();

  const stored = await db.query.customerUserLinks.findFirst({
    where: eq(customerUserLinks.stackUserId, input.stackUserId),
  });

  return stored ?? record;
}

/**
 * Used on first sign-in: find the customer row by email and link it to the
 * Stack user id. Creates a customer row if none exists. Returns the link.
 */
export async function linkStackUserToCustomerByEmail(input: {
  stackUserId: string;
  email: string;
  source?: CustomerUserLinkSource;
}): Promise<CustomerUserLink> {
  const existingLink = await findCustomerUserLinkByStackUserId(input.stackUserId);

  if (existingLink) {
    return existingLink;
  }

  const customer = await upsertCustomerByEmail({ email: input.email });

  return createCustomerUserLink({
    stackUserId: input.stackUserId,
    customerId: customer.id,
    source: input.source ?? "self_signup",
  });
}

/* ------------------------------------------------------------------
 * Customer-scoped order queries
 * ------------------------------------------------------------------ */

export async function listOrdersForCustomer(customerId: string, limit = 50): Promise<AdminQueueItem[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = getDatabase();
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });

  if (!customer) {
    return [];
  }

  const rows = await db.query.orders.findMany({
    where: and(eq(orders.customerId, customerId), ne(orders.status, "draft")),
    orderBy: [desc(orders.createdAt)],
    limit,
  });

  return rows.map((order) => ({
    id: order.id,
    status: order.status,
    deliveryMode: order.deliveryMode,
    selectedOfferCode: order.selectedOfferCode,
    totalCents: order.totalCents,
    designCount: order.designCount,
    childFirstName: order.childFirstName,
    customerEmail: customer.email,
    createdAt: order.createdAt,
    luluPrintJobId: order.luluPrintJobId,
  }));
}

export async function getOrderForCustomer(input: {
  customerId: string;
  orderId: string;
}): Promise<PortalSummary | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = getDatabase();
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, input.orderId), eq(orders.customerId, input.customerId)),
  });

  if (!order) {
    return null;
  }

  return buildPortalSummaryFromOrder(order, `/account/orders/${order.id}`);
}

/* ------------------------------------------------------------------
 * Stripe webhook idempotency
 * ------------------------------------------------------------------ */

export type StripeWebhookEventStatus = "received" | "processed" | "ignored" | "failed";

/**
 * Insert a stripe webhook event row. Returns { firstSeen: true } the first
 * time the event is seen; { firstSeen: false } if the event was already
 * recorded (duplicate delivery). Safe to call concurrently — relies on the
 * unique index on stripe_event_id.
 */
export async function recordStripeWebhookReceipt(input: {
  stripeEventId: string;
  type: string;
  orderId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<{ firstSeen: boolean }> {
  if (!isDatabaseConfigured()) {
    return { firstSeen: true };
  }

  const db = getDatabase();
  const inserted = await db
    .insert(stripeWebhookEvents)
    .values({
      id: createId("swe"),
      stripeEventId: input.stripeEventId,
      type: input.type,
      orderId: input.orderId ?? null,
      payload: input.payload ?? null,
      status: "received",
      receivedAt: now(),
    })
    .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
    .returning({ id: stripeWebhookEvents.id });

  return { firstSeen: inserted.length > 0 };
}

export async function markStripeWebhookProcessed(input: {
  stripeEventId: string;
  status: StripeWebhookEventStatus;
  orderId?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    return;
  }

  const db = getDatabase();
  await db
    .update(stripeWebhookEvents)
    .set({
      status: input.status,
      processedAt: now(),
      ...(input.orderId ? { orderId: input.orderId } : {}),
    })
    .where(eq(stripeWebhookEvents.stripeEventId, input.stripeEventId));
}

/* ------------------------------------------------------------------
 * Phase 3c — Paid Ad Orchestration: local mirrors
 * ------------------------------------------------------------------ */

export type UpsertAdCampaignInput = {
  metaId: string;
  name: string;
  objective: string;
  status: string;
  specialAdCategories?: string[];
  adAccountId: string;
};

export async function upsertAdCampaign(input: UpsertAdCampaignInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(adCampaigns)
    .values({
      id,
      metaId: input.metaId,
      name: input.name,
      objective: input.objective,
      status: input.status,
      specialAdCategories: input.specialAdCategories ?? [],
      adAccountId: input.adAccountId,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: adCampaigns.metaId,
      set: {
        name: input.name,
        objective: input.objective,
        status: input.status,
        specialAdCategories: input.specialAdCategories ?? [],
        updatedAt: now(),
      },
    })
    .returning();
  return row ?? null;
}

export type UpsertAdSetInput = {
  metaId: string;
  campaignId: string;
  name: string;
  status: string;
  dailyBudgetCents?: number | null;
  lifetimeBudgetCents?: number | null;
  optimizationGoal: string;
  billingEvent?: string | null;
  targetingJson?: Record<string, unknown> | null;
  startTime?: Date | null;
  endTime?: Date | null;
};

export async function upsertAdSet(input: UpsertAdSetInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(adSets)
    .values({
      id,
      metaId: input.metaId,
      campaignId: input.campaignId,
      name: input.name,
      status: input.status,
      dailyBudgetCents: input.dailyBudgetCents ?? null,
      lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
      optimizationGoal: input.optimizationGoal,
      billingEvent: input.billingEvent ?? null,
      targetingJson: input.targetingJson ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: adSets.metaId,
      set: {
        name: input.name,
        status: input.status,
        dailyBudgetCents: input.dailyBudgetCents ?? null,
        lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
        optimizationGoal: input.optimizationGoal,
        billingEvent: input.billingEvent ?? null,
        targetingJson: input.targetingJson ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        updatedAt: now(),
      },
    })
    .returning();
  return row ?? null;
}

export type UpsertAdInput = {
  metaId: string;
  adSetId: string;
  name: string;
  status: string;
  adCreativeMetaId?: string | null;
};

export async function upsertAd(input: UpsertAdInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(ads)
    .values({
      id,
      metaId: input.metaId,
      adSetId: input.adSetId,
      name: input.name,
      status: input.status,
      adCreativeMetaId: input.adCreativeMetaId ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: ads.metaId,
      set: {
        name: input.name,
        status: input.status,
        adCreativeMetaId: input.adCreativeMetaId ?? null,
        updatedAt: now(),
      },
    })
    .returning();
  return row ?? null;
}

export type UpsertAdCreativeInput = {
  metaId: string;
  name?: string | null;
  objectStoryId?: string | null;
  briefRef?: string | null;
  effectiveInstagramMediaId?: string | null;
};

export async function upsertAdCreative(input: UpsertAdCreativeInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(adCreatives)
    .values({
      id,
      metaId: input.metaId,
      name: input.name ?? null,
      objectStoryId: input.objectStoryId ?? null,
      briefRef: input.briefRef ?? null,
      effectiveInstagramMediaId: input.effectiveInstagramMediaId ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: adCreatives.metaId,
      set: {
        name: input.name ?? null,
        objectStoryId: input.objectStoryId ?? null,
        briefRef: input.briefRef ?? null,
        effectiveInstagramMediaId: input.effectiveInstagramMediaId ?? null,
        updatedAt: now(),
      },
    })
    .returning();
  return row ?? null;
}

export async function listAdsByStatus(input: { status: string; limit?: number; offset?: number }) {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(ads)
    .where(eq(ads.status, input.status))
    .orderBy(desc(ads.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export async function listNonDeletedAds() {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(ads)
    .where(ne(ads.status, "DELETED"))
    .orderBy(desc(ads.createdAt));
}

export async function listNonDeletedAdSets() {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(adSets)
    .where(ne(adSets.status, "DELETED"))
    .orderBy(desc(adSets.createdAt));
}

export async function listNonDeletedCampaigns() {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(adCampaigns)
    .where(ne(adCampaigns.status, "DELETED"))
    .orderBy(desc(adCampaigns.createdAt));
}

export async function getAdByMetaId(metaId: string) {
  if (!isDatabaseConfigured()) return null;
  return (
    getDatabase().query.ads.findFirst({ where: eq(ads.metaId, metaId) }) ?? null
  );
}

type EntityType = "campaign" | "adset" | "ad";

export async function markEntitySynced(input: { entityType: EntityType; metaId: string }) {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  const syncedAt = now();

  if (input.entityType === "campaign") {
    await db
      .update(adCampaigns)
      .set({ lastSyncedAt: syncedAt })
      .where(eq(adCampaigns.metaId, input.metaId));
  } else if (input.entityType === "adset") {
    await db
      .update(adSets)
      .set({ lastSyncedAt: syncedAt })
      .where(eq(adSets.metaId, input.metaId));
  } else {
    await db
      .update(ads)
      .set({ lastSyncedAt: syncedAt })
      .where(eq(ads.metaId, input.metaId));
  }
}

/* ------------------------------------------------------------------
 * Phase 3d — Daily Metrics Rollup
 * ------------------------------------------------------------------ */

export type UpsertDailyMetricsInput = {
  entityMetaId: string;
  date: string; // YYYY-MM-DD
  impressions?: number;
  reach?: number;
  frequency?: string | null;
  spendCents?: number;
  clicks?: number;
  linkClicks?: number;
  landingPageViews?: number;
  addsToCart?: number;
  initiateCheckouts?: number;
  purchases?: number;
  revenueCents?: number;
  ctr?: string | null;
  cpmCents?: number | null;
  cpcCents?: number | null;
  cpaCents?: number | null;
  roas?: string | null;
  videoP25Views?: number;
  videoP50Views?: number;
  videoP75Views?: number;
  videoP100Views?: number;
  hookRate?: string | null;
  lastSyncedAt: Date;
};

function buildMetricsUpsertValues(input: UpsertDailyMetricsInput) {
  return {
    entityMetaId: input.entityMetaId,
    date: input.date,
    impressions: input.impressions ?? 0,
    reach: input.reach ?? 0,
    frequency: input.frequency ?? null,
    spendCents: input.spendCents ?? 0,
    clicks: input.clicks ?? 0,
    linkClicks: input.linkClicks ?? 0,
    landingPageViews: input.landingPageViews ?? 0,
    addsToCart: input.addsToCart ?? 0,
    initiateCheckouts: input.initiateCheckouts ?? 0,
    purchases: input.purchases ?? 0,
    revenueCents: input.revenueCents ?? 0,
    ctr: input.ctr ?? null,
    cpmCents: input.cpmCents ?? null,
    cpcCents: input.cpcCents ?? null,
    cpaCents: input.cpaCents ?? null,
    roas: input.roas ?? null,
    videoP25Views: input.videoP25Views ?? 0,
    videoP50Views: input.videoP50Views ?? 0,
    videoP75Views: input.videoP75Views ?? 0,
    videoP100Views: input.videoP100Views ?? 0,
    hookRate: input.hookRate ?? null,
    lastSyncedAt: input.lastSyncedAt,
    updatedAt: now(),
  };
}

export async function upsertAdDailyMetrics(input: UpsertDailyMetricsInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const values = { id: crypto.randomUUID(), ...buildMetricsUpsertValues(input), createdAt: now() };
  const [row] = await db
    .insert(adDailyMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [adDailyMetrics.entityMetaId, adDailyMetrics.date],
      set: buildMetricsUpsertValues(input),
    })
    .returning();
  return row ?? null;
}

export async function upsertAdSetDailyMetrics(input: UpsertDailyMetricsInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const values = { id: crypto.randomUUID(), ...buildMetricsUpsertValues(input), createdAt: now() };
  const [row] = await db
    .insert(adsetDailyMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [adsetDailyMetrics.entityMetaId, adsetDailyMetrics.date],
      set: buildMetricsUpsertValues(input),
    })
    .returning();
  return row ?? null;
}

export async function upsertCampaignDailyMetrics(input: UpsertDailyMetricsInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const values = { id: crypto.randomUUID(), ...buildMetricsUpsertValues(input), createdAt: now() };
  const [row] = await db
    .insert(campaignDailyMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [campaignDailyMetrics.entityMetaId, campaignDailyMetrics.date],
      set: buildMetricsUpsertValues(input),
    })
    .returning();
  return row ?? null;
}

export type ListAdDailyMetricsInput = {
  entityMetaIds?: string[];
  dateFrom: string; // YYYY-MM-DD inclusive
  dateTo: string;   // YYYY-MM-DD inclusive
  limit?: number;
  offset?: number;
};

export async function listAdDailyMetrics(input: ListAdDailyMetricsInput) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions = [
    gte(adDailyMetrics.date, input.dateFrom),
    lte(adDailyMetrics.date, input.dateTo),
  ];
  if (input.entityMetaIds && input.entityMetaIds.length > 0) {
    conditions.push(inArray(adDailyMetrics.entityMetaId, input.entityMetaIds));
  }
  return db
    .select()
    .from(adDailyMetrics)
    .where(and(...conditions))
    .orderBy(desc(adDailyMetrics.date))
    .limit(input.limit ?? 500)
    .offset(input.offset ?? 0);
}

export type AdMetricsSummary = {
  totalImpressions: number;
  totalSpendCents: number;
  totalPurchases: number;
  avgCtr: number | null;
  avgCpmCents: number | null;
  avgCpaCents: number | null;
  roas: number | null;
};

export async function getAdMetricsSummary(
  entityMetaId: string,
  range: { dateFrom: string; dateTo: string },
): Promise<AdMetricsSummary> {
  if (!isDatabaseConfigured()) {
    return { totalImpressions: 0, totalSpendCents: 0, totalPurchases: 0, avgCtr: null, avgCpmCents: null, avgCpaCents: null, roas: null };
  }
  const db = getDatabase();
  const [row] = await db
    .select({
      totalImpressions: sql<number>`cast(coalesce(sum(${adDailyMetrics.impressions}), 0) as integer)`,
      totalSpendCents: sql<number>`cast(coalesce(sum(${adDailyMetrics.spendCents}), 0) as integer)`,
      totalPurchases: sql<number>`cast(coalesce(sum(${adDailyMetrics.purchases}), 0) as integer)`,
      totalRevenueCents: sql<number>`cast(coalesce(sum(${adDailyMetrics.revenueCents}), 0) as integer)`,
      avgCtr: avg(adDailyMetrics.ctr),
      avgCpmCents: avg(adDailyMetrics.cpmCents),
      avgCpaCents: avg(adDailyMetrics.cpaCents),
    })
    .from(adDailyMetrics)
    .where(
      and(
        eq(adDailyMetrics.entityMetaId, entityMetaId),
        gte(adDailyMetrics.date, range.dateFrom),
        lte(adDailyMetrics.date, range.dateTo),
      ),
    );

  if (!row) {
    return { totalImpressions: 0, totalSpendCents: 0, totalPurchases: 0, avgCtr: null, avgCpmCents: null, avgCpaCents: null, roas: null };
  }

  const roas =
    row.totalSpendCents > 0
      ? parseFloat((row.totalRevenueCents / row.totalSpendCents).toFixed(4))
      : null;

  return {
    totalImpressions: row.totalImpressions,
    totalSpendCents: row.totalSpendCents,
    totalPurchases: row.totalPurchases,
    avgCtr: row.avgCtr != null ? parseFloat(row.avgCtr as unknown as string) : null,
    avgCpmCents: row.avgCpmCents != null ? parseFloat(row.avgCpmCents as unknown as string) : null,
    avgCpaCents: row.avgCpaCents != null ? parseFloat(row.avgCpaCents as unknown as string) : null,
    roas,
  };
}

export type TopPerformingAdsInput = {
  metric: "roas" | "cpa_cents" | "ctr" | "hook_rate";
  direction: "asc" | "desc";
  dateFrom: string;
  dateTo: string;
  limit?: number;
};

export async function getTopPerformingAds(input: TopPerformingAdsInput) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();

  const metricColMap = {
    roas: adDailyMetrics.roas,
    cpa_cents: adDailyMetrics.cpaCents,
    ctr: adDailyMetrics.ctr,
    hook_rate: adDailyMetrics.hookRate,
  } as const;

  const col = metricColMap[input.metric];
  const orderFn = input.direction === "asc" ? asc : desc;

  const rows = await db
    .select({
      entityMetaId: adDailyMetrics.entityMetaId,
      avgMetric: avg(col),
      totalSpendCents: sql<number>`cast(sum(${adDailyMetrics.spendCents}) as integer)`,
      totalPurchases: sql<number>`cast(sum(${adDailyMetrics.purchases}) as integer)`,
    })
    .from(adDailyMetrics)
    .where(
      and(
        gte(adDailyMetrics.date, input.dateFrom),
        lte(adDailyMetrics.date, input.dateTo),
        isNotNull(col),
      ),
    )
    .groupBy(adDailyMetrics.entityMetaId)
    .orderBy(orderFn(avg(col)))
    .limit(input.limit ?? 20);

  return rows.map((r) => ({
    entityMetaId: r.entityMetaId,
    avgMetric: r.avgMetric != null ? parseFloat(r.avgMetric as unknown as string) : null,
    totalSpendCents: r.totalSpendCents,
    totalPurchases: r.totalPurchases,
  }));
}

export async function getAdsMetricsHistory(
  entityMetaId: string,
  { days = 14 }: { days?: number } = {},
) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - (days - 1));

  const toStr = (d: Date) => d.toISOString().slice(0, 10);

  return db
    .select()
    .from(adDailyMetrics)
    .where(
      and(
        eq(adDailyMetrics.entityMetaId, entityMetaId),
        gte(adDailyMetrics.date, toStr(dateFrom)),
        lte(adDailyMetrics.date, toStr(dateTo)),
      ),
    )
    .orderBy(asc(adDailyMetrics.date));
}

/* ------------------------------------------------------------------
 * Phase 4 — AI Agent Control Plane
 * ------------------------------------------------------------------ */

export type InsertAgentProposalInput = {
  id: string;
  kind: AgentProposalKind;
  payloadJson: Record<string, unknown>;
  rationale?: string | null;
  targetEntityType?: string | null;
  targetMetaId?: string | null;
  autoApproved: boolean;
  approvalRequiredReason?: string | null;
  createdBy: string;
  expiresAt: Date;
  status?: AgentProposalStatus;
};

export async function insertAgentProposal(input: InsertAgentProposalInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(agentProposals)
    .values({
      id: input.id,
      kind: input.kind,
      status: input.status ?? (input.autoApproved ? "approved" : "pending"),
      payloadJson: input.payloadJson,
      rationale: input.rationale ?? null,
      targetEntityType: input.targetEntityType ?? null,
      targetMetaId: input.targetMetaId ?? null,
      autoApproved: input.autoApproved,
      approvalRequiredReason: input.approvalRequiredReason ?? null,
      createdBy: input.createdBy,
      expiresAt: input.expiresAt,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return row ?? null;
}

export async function getAgentProposalById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(agentProposals)
    .where(eq(agentProposals.id, id))
    .limit(1);
  return row ?? null;
}

export type ListAgentProposalsInput = {
  status?: AgentProposalStatus;
  kind?: AgentProposalKind;
  createdAfter?: Date;
  limit?: number;
  offset?: number;
};

export async function listAgentProposals(input: ListAgentProposalsInput) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions: ReturnType<typeof eq>[] = [];
  if (input.status) conditions.push(eq(agentProposals.status, input.status));
  if (input.kind) conditions.push(eq(agentProposals.kind, input.kind));
  if (input.createdAfter) conditions.push(gt(agentProposals.createdAt, input.createdAfter));

  return db
    .select()
    .from(agentProposals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentProposals.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export type UpdateAgentProposalStatusInput = {
  id: string;
  status: AgentProposalStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  executedAt?: Date | null;
  executionResultJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

export async function updateAgentProposalStatus(input: UpdateAgentProposalStatusInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: now(),
  };
  if (input.reviewedBy !== undefined) patch.reviewedBy = input.reviewedBy;
  if (input.reviewedAt !== undefined) patch.reviewedAt = input.reviewedAt;
  if (input.executedAt !== undefined) patch.executedAt = input.executedAt;
  if (input.executionResultJson !== undefined) patch.executionResultJson = input.executionResultJson;
  if (input.errorMessage !== undefined) patch.errorMessage = input.errorMessage;

  const [row] = await db
    .update(agentProposals)
    .set(patch as Partial<typeof agentProposals.$inferInsert>)
    .where(eq(agentProposals.id, input.id))
    .returning();
  return row ?? null;
}

export async function expirePendingAgentProposals() {
  if (!isDatabaseConfigured()) return 0;
  const db = getDatabase();
  const result = await db
    .update(agentProposals)
    .set({ status: "expired", updatedAt: now() })
    .where(
      and(
        eq(agentProposals.status, "pending"),
        lt(agentProposals.expiresAt, now()),
      ),
    )
    .returning({ id: agentProposals.id });
  return result.length;
}

export type InsertAgentJournalEntryInput = {
  id: string;
  kind: AgentJournalEntryKind;
  relatedProposalId?: string | null;
  targetEntityType?: string | null;
  targetMetaId?: string | null;
  note: string;
  metricsSnapshotJson?: Record<string, unknown> | null;
  deltaFromBaselineJson?: Record<string, unknown> | null;
  createdBy: string;
};

export async function insertAgentJournalEntry(input: InsertAgentJournalEntryInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(agentJournal)
    .values({
      id: input.id,
      kind: input.kind,
      relatedProposalId: input.relatedProposalId ?? null,
      targetEntityType: input.targetEntityType ?? null,
      targetMetaId: input.targetMetaId ?? null,
      note: input.note,
      metricsSnapshotJson: input.metricsSnapshotJson ?? null,
      deltaFromBaselineJson: input.deltaFromBaselineJson ?? null,
      createdBy: input.createdBy,
      createdAt: now(),
    })
    .returning();
  return row ?? null;
}

export type ListAgentJournalInput = {
  kind?: AgentJournalEntryKind;
  relatedProposalId?: string;
  createdAfter?: Date;
  limit?: number;
  offset?: number;
};

export async function listAgentJournal(input: ListAgentJournalInput) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions: ReturnType<typeof eq>[] = [];
  if (input.kind) conditions.push(eq(agentJournal.kind, input.kind));
  if (input.relatedProposalId) conditions.push(eq(agentJournal.relatedProposalId, input.relatedProposalId));
  if (input.createdAfter) conditions.push(gt(agentJournal.createdAt, input.createdAfter));

  return db
    .select()
    .from(agentJournal)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentJournal.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
}

export type InsertAgentBaselineInput = {
  id: string;
  proposalId: string;
  targetMetaId: string;
  targetEntityType: string;
  metricsJson: Record<string, unknown>;
};

export async function insertAgentBaseline(input: InsertAgentBaselineInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(agentBaselines)
    .values({
      id: input.id,
      proposalId: input.proposalId,
      targetMetaId: input.targetMetaId,
      targetEntityType: input.targetEntityType,
      metricsJson: input.metricsJson,
      capturedAt: now(),
    })
    .returning();
  return row ?? null;
}

export async function getAgentBaselineByProposalId(proposalId: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(agentBaselines)
    .where(eq(agentBaselines.proposalId, proposalId))
    .limit(1);
  return row ?? null;
}

// Returns baselines that fall in the 24h or 72h observation window and do not
// yet have a matching journal entry for that window. Window edges use a ±30 min
// tolerance so 6-hourly cron runs never miss a slot.
export type BaselineNeedingObservation = {
  id: string;
  proposalId: string;
  targetMetaId: string;
  targetEntityType: string;
  metricsJson: Record<string, unknown>;
  capturedAt: Date;
  observationKind: "outcome_observed_24h" | "outcome_observed_72h";
};

export async function findBaselinesNeedingObservation(
  batchLimit = 50,
): Promise<BaselineNeedingObservation[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();

  // Raw SQL is clearest here: two window conditions unioned, each with a NOT EXISTS
  // guard against duplicate journal entries.
  const rows = await db.execute<{
    id: string;
    proposal_id: string;
    target_meta_id: string;
    target_entity_type: string;
    metrics_json: Record<string, unknown>;
    captured_at: Date;
    observation_window: string;
  }>(sql`
    SELECT
      ab.id,
      ab.proposal_id,
      ab.target_meta_id,
      ab.target_entity_type,
      ab.metrics_json,
      ab.captured_at,
      '24h' AS observation_window
    FROM agent_baselines ab
    WHERE
      ab.captured_at >= NOW() - INTERVAL '24.5 hours'
      AND ab.captured_at <= NOW() - INTERVAL '23.5 hours'
      AND NOT EXISTS (
        SELECT 1 FROM agent_journal aj
        WHERE aj.related_proposal_id = ab.proposal_id
          AND aj.kind = 'outcome_observed_24h'
      )

    UNION ALL

    SELECT
      ab.id,
      ab.proposal_id,
      ab.target_meta_id,
      ab.target_entity_type,
      ab.metrics_json,
      ab.captured_at,
      '72h' AS observation_window
    FROM agent_baselines ab
    WHERE
      ab.captured_at >= NOW() - INTERVAL '72.5 hours'
      AND ab.captured_at <= NOW() - INTERVAL '71.5 hours'
      AND NOT EXISTS (
        SELECT 1 FROM agent_journal aj
        WHERE aj.related_proposal_id = ab.proposal_id
          AND aj.kind = 'outcome_observed_72h'
      )

    ORDER BY captured_at ASC
    LIMIT ${batchLimit}
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    proposalId: r.proposal_id,
    targetMetaId: r.target_meta_id,
    targetEntityType: r.target_entity_type,
    metricsJson: r.metrics_json as Record<string, unknown>,
    capturedAt: new Date(r.captured_at),
    observationKind: (r.observation_window === "24h"
      ? "outcome_observed_24h"
      : "outcome_observed_72h") as "outcome_observed_24h" | "outcome_observed_72h",
  }));
}

// Generic metrics summary aggregator that works across all three daily-metrics
// tables. The caller passes the entity type to route to the right table.
export async function getEntityMetricsSummary(
  entityType: "ad" | "adset" | "campaign",
  entityMetaId: string,
  range: { dateFrom: string; dateTo: string },
): Promise<AdMetricsSummary> {
  if (!isDatabaseConfigured()) {
    return {
      totalImpressions: 0,
      totalSpendCents: 0,
      totalPurchases: 0,
      avgCtr: null,
      avgCpmCents: null,
      avgCpaCents: null,
      roas: null,
    };
  }

  const table =
    entityType === "ad"
      ? adDailyMetrics
      : entityType === "adset"
        ? adsetDailyMetrics
        : campaignDailyMetrics;

  const db = getDatabase();
  const [row] = await db
    .select({
      totalImpressions: sql<number>`cast(coalesce(sum(${table.impressions}), 0) as integer)`,
      totalSpendCents: sql<number>`cast(coalesce(sum(${table.spendCents}), 0) as integer)`,
      totalPurchases: sql<number>`cast(coalesce(sum(${table.purchases}), 0) as integer)`,
      totalRevenueCents: sql<number>`cast(coalesce(sum(${table.revenueCents}), 0) as integer)`,
      avgCtr: avg(table.ctr),
      avgCpmCents: avg(table.cpmCents),
      avgCpaCents: avg(table.cpaCents),
    })
    .from(table)
    .where(
      and(
        eq(table.entityMetaId, entityMetaId),
        gte(table.date, range.dateFrom),
        lte(table.date, range.dateTo),
      ),
    );

  if (!row) {
    return {
      totalImpressions: 0,
      totalSpendCents: 0,
      totalPurchases: 0,
      avgCtr: null,
      avgCpmCents: null,
      avgCpaCents: null,
      roas: null,
    };
  }

  const roas =
    row.totalSpendCents > 0
      ? parseFloat((row.totalRevenueCents / row.totalSpendCents).toFixed(4))
      : null;

  return {
    totalImpressions: row.totalImpressions,
    totalSpendCents: row.totalSpendCents,
    totalPurchases: row.totalPurchases,
    avgCtr: row.avgCtr != null ? parseFloat(row.avgCtr as unknown as string) : null,
    avgCpmCents: row.avgCpmCents != null ? parseFloat(row.avgCpmCents as unknown as string) : null,
    avgCpaCents: row.avgCpaCents != null ? parseFloat(row.avgCpaCents as unknown as string) : null,
    roas,
  };
}

export async function insertCreativeRequest(input: { id: string; briefJson: Record<string, unknown> }) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(creativeRequests)
    .values({
      id: input.id,
      briefJson: input.briefJson,
      status: "pending",
      createdAt: now(),
    })
    .returning();
  return row ?? null;
}

// ─── Creative Request fulfillment helpers (Phase 4 close-loop) ────────────────

export async function listPendingCreativeRequests({ limit }: { limit: number }) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  return db
    .select()
    .from(creativeRequests)
    .where(eq(creativeRequests.status, "pending"))
    .orderBy(asc(creativeRequests.createdAt))
    .limit(limit);
}

export async function getCreativeRequestById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(creativeRequests)
    .where(eq(creativeRequests.id, id))
    .limit(1);
  return row ?? null;
}

export type ListCreativeRequestsInput = {
  status?: "pending" | "fulfilled" | "rejected" | "all";
  limit?: number;
  offset?: number;
};

export async function listCreativeRequests({ status, limit = 50, offset = 0 }: ListCreativeRequestsInput) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions = status && status !== "all" ? eq(creativeRequests.status, status) : undefined;
  return db
    .select()
    .from(creativeRequests)
    .where(conditions)
    .orderBy(desc(creativeRequests.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function markCreativeRequestFulfilled(input: {
  id: string;
  briefId: string;
  assetIds: string[];
  fulfilledAt: Date;
}) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(creativeRequests)
    .set({
      status: "fulfilled",
      fulfilledAt: input.fulfilledAt,
      resultJson: { briefId: input.briefId, assetIds: input.assetIds },
      lastError: null,
    })
    .where(eq(creativeRequests.id, input.id))
    .returning();
  return row ?? null;
}

export async function markCreativeRequestRejected(input: {
  id: string;
  reason: string;
  rejectedAt: Date;
}) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(creativeRequests)
    .set({
      status: "rejected",
      rejectedAt: input.rejectedAt,
      lastError: input.reason,
    })
    .where(eq(creativeRequests.id, input.id))
    .returning();
  return row ?? null;
}

export async function incrementCreativeRequestAttempts(input: {
  id: string;
  lastError: string;
}) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(creativeRequests)
    .set({
      attemptCount: sql<number>`${creativeRequests.attemptCount} + 1`,
      lastError: input.lastError,
    })
    .where(eq(creativeRequests.id, input.id))
    .returning();
  return row ?? null;
}

// ─── Phase 2a — Creative Library ─────────────────────────────────────────────

export type InsertCreativeBriefInput = {
  id: string;
  kind: CreativeBriefKind;
  concept: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  persona?: string | null;
  occasion?: string | null;
  offerCode?: string | null;
  visualPrompt: string;
  voiceFamily?: string | null;
  briefVersion?: string;
  deterministicSeed?: string | null;
  /** Phase 7a: copy element IDs — shape { hook_id?, body_id?, cta_id?, visual_style_id? } */
  elementIds?: BriefElementIds | null;
  createdBy?: string | null;
};

export async function insertCreativeBrief(input: InsertCreativeBriefInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(creativeBriefs)
    .values({
      id: input.id,
      kind: input.kind,
      concept: input.concept,
      format: input.format,
      hook: input.hook,
      body: input.body,
      cta: input.cta,
      persona: input.persona ?? null,
      occasion: input.occasion ?? null,
      offerCode: input.offerCode ?? null,
      visualPrompt: input.visualPrompt,
      voiceFamily: input.voiceFamily ?? null,
      briefVersion: input.briefVersion ?? "2026-04-a",
      deterministicSeed: input.deterministicSeed ?? null,
      elementIds: input.elementIds ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return row ?? null;
}

export type InsertCreativeAssetInput = {
  id: string;
  briefId?: string | null;
  source: CreativeAssetSource;
  kind: CreativeAssetKind;
  parentAssetId?: string | null;
  gcsBucket: string;
  gcsObject: string;
  mimeType: string;
  widthPx?: number | null;
  heightPx?: number | null;
  durationSeconds?: string | null;
  tagsJson?: CreativeAssetTagsJson;
  complianceStatus?: CreativeAssetComplianceStatus;
  complianceCheckedAt?: Date | null;
  complianceReportJson?: Record<string, unknown> | null;
  consentSource?: string | null;
  consentProof?: string | null;
  createdBy?: string | null;
};

export async function insertCreativeAsset(input: InsertCreativeAssetInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(creativeAssets)
    .values({
      id: input.id,
      briefId: input.briefId ?? null,
      source: input.source,
      kind: input.kind,
      parentAssetId: input.parentAssetId ?? null,
      gcsBucket: input.gcsBucket,
      gcsObject: input.gcsObject,
      mimeType: input.mimeType,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      durationSeconds: input.durationSeconds ?? null,
      tagsJson: input.tagsJson ?? {},
      complianceStatus: input.complianceStatus ?? "pending",
      complianceCheckedAt: input.complianceCheckedAt ?? null,
      complianceReportJson: input.complianceReportJson ?? null,
      consentSource: input.consentSource ?? null,
      consentProof: input.consentProof ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return row ?? null;
}

export type ListCreativeAssetsFilter = {
  source?: CreativeAssetSource;
  kind?: CreativeAssetKind;
  complianceStatus?: CreativeAssetComplianceStatus;
  tagsQuery?: Partial<CreativeAssetTagsJson>;
  limit?: number;
  offset?: number;
};

export async function listCreativeAssets(filter: ListCreativeAssetsFilter = {}) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();

  const conditions: ReturnType<typeof eq>[] = [];

  if (filter.source) {
    conditions.push(eq(creativeAssets.source, filter.source));
  }
  if (filter.kind) {
    conditions.push(eq(creativeAssets.kind, filter.kind));
  }
  if (filter.complianceStatus) {
    conditions.push(eq(creativeAssets.complianceStatus, filter.complianceStatus));
  }
  if (filter.tagsQuery && Object.keys(filter.tagsQuery).length > 0) {
    conditions.push(
      sql`${creativeAssets.tagsJson} @> ${JSON.stringify(filter.tagsQuery)}::jsonb` as ReturnType<typeof eq>,
    );
  }

  const query = db
    .select()
    .from(creativeAssets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creativeAssets.createdAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  return query;
}

export async function getCreativeAssetById(id: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(creativeAssets)
    .where(eq(creativeAssets.id, id))
    .limit(1);
  return row ?? null;
}

export async function getCreativeAssetCrops(parentId: string) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  return db
    .select()
    .from(creativeAssets)
    .where(eq(creativeAssets.parentAssetId, parentId))
    .orderBy(asc(creativeAssets.kind));
}

export async function updateCreativeAssetCompliance(input: {
  id: string;
  status: CreativeAssetComplianceStatus;
  reportJson: Record<string, unknown> | null;
}) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(creativeAssets)
    .set({
      complianceStatus: input.status,
      complianceReportJson: input.reportJson,
      complianceCheckedAt: now(),
      updatedAt: now(),
    })
    .where(eq(creativeAssets.id, input.id))
    .returning();
  return row ?? null;
}

export async function searchCreativeAssetsByTag(input: {
  tag: { key: keyof CreativeAssetTagsJson; value: string };
  limit?: number;
}) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const tagFilter = { [input.tag.key]: input.tag.value };
  return db
    .select()
    .from(creativeAssets)
    .where(
      sql`${creativeAssets.tagsJson} @> ${JSON.stringify(tagFilter)}::jsonb`,
    )
    .orderBy(desc(creativeAssets.createdAt))
    .limit(input.limit ?? 50);
}

export async function countCreativeAssetsBySource() {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  return db
    .select({
      source: creativeAssets.source,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(creativeAssets)
    .groupBy(creativeAssets.source)
    .orderBy(desc(sql`count(*)`));
}

// ─── Phase 5 — Meta Webhook Events ───────────────────────────────────────────

export async function insertMetaWebhookEvent(input: {
  id: string;
  topic: string;
  objectType: string;
  payloadJson: Record<string, unknown>;
  signatureHeader: string;
}): Promise<{ id: string; firstSeen: boolean }> {
  if (!isDatabaseConfigured()) return { id: input.id, firstSeen: true };
  const db = getDatabase();
  const ts = now();
  const rows = await db
    .insert(metaWebhookEvents)
    .values({
      id: input.id,
      provider: "meta",
      topic: input.topic,
      objectType: input.objectType,
      payloadJson: input.payloadJson,
      signatureHeader: input.signatureHeader,
      status: "received",
      receivedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoNothing()
    .returning({ id: metaWebhookEvents.id });
  const firstSeen = rows.length > 0;
  return { id: input.id, firstSeen };
}

export async function markMetaWebhookEventProcessed(input: {
  id: string;
  status: MetaWebhookStatus;
  errorMessage?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(metaWebhookEvents)
    .set({
      status: input.status,
      processedAt: now(),
      errorMessage: input.errorMessage ?? null,
      updatedAt: now(),
    })
    .where(eq(metaWebhookEvents.id, input.id));
}

// ─── Phase 5 — DM Inbox Repositories ─────────────────────────────────────────
// DmPlatform, DmThreadStatus, DmMessageDirection, DmAttachment, DmThread, DmMessage
// are imported above and re-exported via schema's wildcard from index.ts.

export type UpsertDmThreadInput = {
  platform: DmPlatform;
  platformUserId: string;
  platformUserHandle?: string | null;
  userDisplayName?: string | null;
  avatarUrl?: string | null;
};

export async function upsertDmThread(input: UpsertDmThreadInput): Promise<DmThread | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const ts = now();
  const id = createId("dmth");
  const [row] = await db
    .insert(dmThreads)
    .values({
      id,
      platform: input.platform,
      platformUserId: input.platformUserId,
      platformUserHandle: input.platformUserHandle ?? null,
      userDisplayName: input.userDisplayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      status: "open",
      unreadCount: 0,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: [dmThreads.platform, dmThreads.platformUserId],
      set: {
        platformUserHandle: input.platformUserHandle ?? null,
        userDisplayName: input.userDisplayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: ts,
      },
    })
    .returning();
  return row ?? null;
}

export async function insertDmMessage(input: {
  id: string;
  threadId: string;
  direction: DmMessageDirection;
  metaMessageId: string;
  body: string;
  attachmentsJson?: DmAttachment[] | null;
  sentBy?: string | null;
  tag?: string | null;
  sentAt: Date;
}): Promise<DmMessage | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const ts = now();
  // Idempotent by metaMessageId — return existing row on conflict
  const existing = await db
    .select()
    .from(dmMessages)
    .where(eq(dmMessages.metaMessageId, input.metaMessageId))
    .limit(1);
  if (existing.length > 0) return existing[0] ?? null;

  const [row] = await db
    .insert(dmMessages)
    .values({
      id: input.id,
      threadId: input.threadId,
      direction: input.direction,
      metaMessageId: input.metaMessageId,
      body: input.body,
      attachmentsJson: input.attachmentsJson ?? null,
      sentBy: input.sentBy ?? null,
      tag: input.tag ?? null,
      sentAt: input.sentAt,
      createdAt: ts,
    })
    .returning();
  return row ?? null;
}

export async function getDmThreadById(id: string): Promise<DmThread | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.dmThreads.findFirst({ where: eq(dmThreads.id, id) });
  return row ?? null;
}

export async function getDmThreadByPlatformUser(
  platform: DmPlatform,
  platformUserId: string,
): Promise<DmThread | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const row = await db.query.dmThreads.findFirst({
    where: and(eq(dmThreads.platform, platform), eq(dmThreads.platformUserId, platformUserId)),
  });
  return row ?? null;
}

export async function listDmThreads(input: {
  platform?: DmPlatform;
  status?: DmThreadStatus;
  limit: number;
  offset: number;
}): Promise<DmThread[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();

  const conditions = [];
  if (input.platform) conditions.push(eq(dmThreads.platform, input.platform));
  if (input.status) conditions.push(eq(dmThreads.status, input.status));

  return db
    .select()
    .from(dmThreads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dmThreads.lastUserMessageAt))
    .limit(input.limit)
    .offset(input.offset);
}

export async function getDmThreadWithMessages(
  id: string,
  opts: { messageLimit?: number; messageOffset?: number } = {},
): Promise<{ thread: DmThread; messages: DmMessage[] } | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();

  const thread = await db.query.dmThreads.findFirst({ where: eq(dmThreads.id, id) });
  if (!thread) return null;

  const messages = await db
    .select()
    .from(dmMessages)
    .where(eq(dmMessages.threadId, id))
    .orderBy(asc(dmMessages.sentAt))
    .limit(opts.messageLimit ?? 50)
    .offset(opts.messageOffset ?? 0);

  return { thread, messages };
}

export async function touchDmThreadLastUserMessage(input: {
  threadId: string;
  sentAt: Date;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  const windowExpiresAt = new Date(input.sentAt.getTime() + 24 * 60 * 60 * 1000);
  await db
    .update(dmThreads)
    .set({
      lastUserMessageAt: input.sentAt,
      windowExpiresAt,
      unreadCount: sql`${dmThreads.unreadCount} + 1`,
      updatedAt: now(),
    })
    .where(eq(dmThreads.id, input.threadId));
}

export async function touchDmThreadLastAgentMessage(input: {
  threadId: string;
  sentAt: Date;
  assignedTo?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  const set: Partial<typeof dmThreads.$inferInsert> = {
    lastAgentMessageAt: input.sentAt,
    unreadCount: 0,
    updatedAt: now(),
  };
  if (input.assignedTo !== undefined) {
    set.assignedTo = input.assignedTo;
  }
  await db.update(dmThreads).set(set).where(eq(dmThreads.id, input.threadId));
}

export async function markDmThreadStatus(input: {
  id: string;
  status: DmThreadStatus;
  assignedTo?: string | null;
}): Promise<DmThread | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const set: Partial<typeof dmThreads.$inferInsert> = {
    status: input.status,
    updatedAt: now(),
  };
  if (input.assignedTo !== undefined) {
    set.assignedTo = input.assignedTo;
  }
  const [row] = await db
    .update(dmThreads)
    .set(set)
    .where(eq(dmThreads.id, input.id))
    .returning();
  return row ?? null;
}

export async function setDmThreadTicket(input: {
  id: string;
  ticketId: string;
}): Promise<DmThread | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(dmThreads)
    .set({ ticketId: input.ticketId, updatedAt: now() })
    .where(eq(dmThreads.id, input.id))
    .returning();
  return row ?? null;
}

// ─── DM Keyword Responses ─────────────────────────────────────────────────────

export async function listDmKeywordResponses(input: {
  enabledOnly?: boolean;
  platform?: DmPlatform;
} = {}): Promise<DmKeywordResponse[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions = [];
  if (input.enabledOnly) conditions.push(eq(dmKeywordResponses.enabled, true));
  if (input.platform) {
    // null platform = applies to all; exact platform match also applies
    conditions.push(
      sql`(${dmKeywordResponses.platform} IS NULL OR ${dmKeywordResponses.platform} = ${input.platform})`,
    );
  }
  return db
    .select()
    .from(dmKeywordResponses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(dmKeywordResponses.createdAt));
}

export async function insertDmKeywordResponse(input: {
  id: string;
  label: string;
  matchKind: KeywordResponseMatchKind;
  matchPattern: string;
  responseBody: string;
  platform?: DmPlatform | null;
  enabled?: boolean;
}): Promise<DmKeywordResponse | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const ts = now();
  const [row] = await db
    .insert(dmKeywordResponses)
    .values({
      id: input.id,
      label: input.label,
      matchKind: input.matchKind,
      matchPattern: input.matchPattern,
      responseBody: input.responseBody,
      platform: input.platform ?? null,
      enabled: input.enabled ?? true,
      matchCount: 0,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row ?? null;
}

export async function updateDmKeywordResponse(input: {
  id: string;
  patch: Partial<{
    label: string;
    matchKind: KeywordResponseMatchKind;
    matchPattern: string;
    responseBody: string;
    platform: DmPlatform | null;
    enabled: boolean;
  }>;
}): Promise<DmKeywordResponse | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(dmKeywordResponses)
    .set({ ...input.patch, updatedAt: now() })
    .where(eq(dmKeywordResponses.id, input.id))
    .returning();
  return row ?? null;
}

export async function deleteDmKeywordResponse(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db = getDatabase();
  const result = await db
    .delete(dmKeywordResponses)
    .where(eq(dmKeywordResponses.id, id))
    .returning({ id: dmKeywordResponses.id });
  return result.length > 0;
}

export async function incrementDmKeywordResponseMatch(input: {
  id: string;
  matchedAt: Date;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(dmKeywordResponses)
    .set({
      matchCount: sql`${dmKeywordResponses.matchCount} + 1`,
      lastMatchedAt: input.matchedAt,
      updatedAt: now(),
    })
    .where(eq(dmKeywordResponses.id, input.id));
}

// ─── Phase 3b — Organic Backfill helpers ─────────────────────────────────────

export const organicPostApprovalStatusExported = organicPostApprovalStatusValues;
export type { OrganicPostApprovalStatus };

/**
 * List organic posts in the given window that are in an active/upcoming state.
 * Used by the backfill cron to see what already occupies each slot.
 */
export async function listUpcomingOrganicPosts({
  fromDate,
  toDate,
}: {
  fromDate: Date;
  toDate: Date;
}) {
  if (!isDatabaseConfigured()) return [];
  return getDatabase()
    .select()
    .from(organicPosts)
    .where(
      and(
        inArray(organicPosts.status, ["scheduled", "draft", "approved"] as OrganicPostStatus[]),
        gte(organicPosts.scheduledAt, fromDate),
        lt(organicPosts.scheduledAt, toDate),
      ),
    )
    .orderBy(asc(organicPosts.scheduledAt));
}

/**
 * Alias used by the slot-rules engine to load existing posts for a window.
 * Returns scheduled_at, platform, format so the pure functions can compute
 * which slots are already filled without pulling full post data.
 */
export async function listUnfilledSlots({
  fromDate,
  toDate,
}: {
  fromDate: Date;
  toDate: Date;
}) {
  // The actual "unfilled" computation is pure TS in slot-rules.ts.
  // This function returns existing posts so the caller can diff against the full slot grid.
  return listUpcomingOrganicPosts({ fromDate, toDate });
}

export type UpdateOrganicPostApprovalInput = {
  id: string;
  approvalStatus: OrganicPostApprovalStatus;
  approvedBy?: string | null;
};

/**
 * Transition approval_status on a post (draft → approved | rejected).
 * Sets approved_at automatically when transitioning to 'approved'.
 */
export async function updateOrganicPostApproval(input: UpdateOrganicPostApprovalInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const approvedAt = input.approvalStatus === "approved" ? now() : undefined;
  const [row] = await db
    .update(organicPosts)
    .set({
      approvalStatus: input.approvalStatus,
      ...(input.approvedBy !== undefined ? { approvedBy: input.approvedBy } : {}),
      ...(approvedAt !== undefined ? { approvedAt } : {}),
      updatedAt: now(),
    })
    .where(eq(organicPosts.id, input.id))
    .returning();
  return row ?? null;
}

export type CountOrganicPostsByPlatformResult = {
  platform: OrganicPostPlatform;
  count: number;
};

/**
 * Count posts (scheduled/draft/approved) per platform within a date window.
 * Used by the backfill cron to understand slot saturation per platform.
 */
export async function countOrganicPostsByPlatform({
  fromDate,
  toDate,
}: {
  fromDate: Date;
  toDate: Date;
}): Promise<CountOrganicPostsByPlatformResult[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const rows = await db
    .select({
      platform: organicPosts.platform,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(organicPosts)
    .where(
      and(
        inArray(organicPosts.status, ["scheduled", "draft", "approved"] as OrganicPostStatus[]),
        gte(organicPosts.scheduledAt, fromDate),
        lt(organicPosts.scheduledAt, toDate),
      ),
    )
    .groupBy(organicPosts.platform);
  return rows as CountOrganicPostsByPlatformResult[];
}

/**
 * Finds assets whose gcs_object appears in organic_posts.source_creative_asset_id
 * within the last N days. Used by the backfill cron to deprioritize recently-used assets.
 */
export async function listRecentlyUsedCreativeAssetIds({
  sinceDaysAgo,
}: {
  sinceDaysAgo: number;
}): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const since = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ assetId: organicPosts.sourceCreativeAssetId })
    .from(organicPosts)
    .where(
      and(
        isNotNull(organicPosts.sourceCreativeAssetId),
        gte(organicPosts.createdAt, since),
      ),
    );
  return rows
    .map((r) => r.assetId)
    .filter((id): id is string => id !== null && id !== undefined);
}

export type InsertBackfilledOrganicPostInput = {
  id: string;
  platform: OrganicPostPlatform;
  format: OrganicPostFormat;
  caption: string;
  imageAssetIds: string[];
  scheduledAt: Date;
  sourceCreativeAssetId: string;
  backfilledAt: Date;
  createdBy?: string | null;
};

/**
 * Insert an auto-generated organic post from the backfill cron.
 * Sets status='scheduled', approval_status='auto_generated', backfilled_at=now().
 */
export async function insertBackfilledOrganicPost(input: InsertBackfilledOrganicPostInput) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .insert(organicPosts)
    .values({
      id: input.id,
      platform: input.platform,
      format: input.format,
      status: "scheduled",
      approvalStatus: "auto_generated",
      caption: input.caption,
      firstComment: null,
      imageAssetIds: input.imageAssetIds,
      scheduledAt: input.scheduledAt,
      publishingAttempts: 0,
      publishedAt: null,
      metaFbPostId: null,
      metaIgPostId: null,
      errorMessage: null,
      backfilledAt: input.backfilledAt,
      sourceCreativeAssetId: input.sourceCreativeAssetId,
      createdBy: input.createdBy ?? "backfill-cron",
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return row ?? null;
}

// ─── Phase 7a — Copy Element Store (APPEND) ──────────────────────────────────
// Additional imports needed for Phase 7a (appended to avoid merge conflicts).
import {
  copyElements,
  copyElementKindValues,
} from "./schema";
import type {
  CopyElement,
  NewCopyElement,
  CopyElementKind,
  BriefElementIds,
} from "./schema";

// Re-export kinds for convenience
export { copyElementKindValues };
export type { CopyElement, CopyElementKind, BriefElementIds };

// ─── Wilson score lower bound ─────────────────────────────────────────────────
/**
 * Wilson score lower bound for a binomial proportion.
 * Used to produce a conservative confidence estimate for (purchases / clicks).
 * z = 1.96 gives 95% confidence interval lower bound.
 */
export function wilsonLowerBound(successes: number, trials: number, z = 1.96): number {
  if (trials <= 0) return 0;
  const pHat = successes / trials;
  const z2 = z * z;
  const numerator = pHat + z2 / (2 * trials) - z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * trials)) / trials);
  const denominator = 1 + z2 / trials;
  return Math.max(0, numerator / denominator);
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

export type InsertCopyElementInput = {
  id: string;
  kind: CopyElementKind;
  text: string;
  label?: string | null;
  audienceTag?: string | null;
  tagsJson?: Record<string, string | boolean | number>;
  createdBy?: string | null;
};

export async function insertCopyElement(input: InsertCopyElementInput): Promise<CopyElement | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const ts = now();
  const [row] = await db
    .insert(copyElements)
    .values({
      id: input.id,
      kind: input.kind,
      text: input.text,
      label: input.label ?? null,
      audienceTag: input.audienceTag ?? null,
      tagsJson: input.tagsJson ?? {},
      usageCount: 0,
      lastUsedAt: null,
      retiredAt: null,
      createdBy: input.createdBy ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  return row ?? null;
}

export async function getCopyElementById(id: string): Promise<CopyElement | null> {
  if (!isDatabaseConfigured()) return null;
  const row = await getDatabase().query.copyElements.findFirst({
    where: eq(copyElements.id, id),
  });
  return row ?? null;
}

export type ListCopyElementsInput = {
  kind?: CopyElementKind;
  audienceTag?: string;
  /** If false (default), only non-retired elements. If true, include retired. */
  retired?: boolean;
  limit?: number;
  offset?: number;
};

export async function listCopyElements(input: ListCopyElementsInput = {}): Promise<CopyElement[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const conditions = [
    ...(input.kind ? [eq(copyElements.kind, input.kind)] : []),
    ...(input.audienceTag ? [eq(copyElements.audienceTag, input.audienceTag)] : []),
    ...(!input.retired ? [sql`${copyElements.retiredAt} IS NULL`] : []),
  ];

  return db
    .select()
    .from(copyElements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(copyElements.usageCount), asc(copyElements.createdAt))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export type SearchCopyElementsByTextInput = {
  kind?: CopyElementKind;
  query: string;
  limit?: number;
};

export async function searchCopyElementsByText(
  input: SearchCopyElementsByTextInput,
): Promise<CopyElement[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const escapedQuery = `%${input.query.replace(/[%_\\]/g, "\\$&")}%`;
  const conditions = [
    sql`${copyElements.text} ILIKE ${escapedQuery}`,
    sql`${copyElements.retiredAt} IS NULL`,
    ...(input.kind ? [eq(copyElements.kind, input.kind)] : []),
  ];
  return db
    .select()
    .from(copyElements)
    .where(and(...conditions))
    .orderBy(desc(copyElements.usageCount))
    .limit(input.limit ?? 20);
}

export async function touchCopyElementUsage(input: {
  id: string;
  usedAt: Date;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDatabase();
  await db
    .update(copyElements)
    .set({
      usageCount: sql`${copyElements.usageCount} + 1`,
      lastUsedAt: input.usedAt,
      updatedAt: now(),
    })
    .where(eq(copyElements.id, input.id));
}

export async function retireCopyElement(id: string): Promise<CopyElement | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  const [row] = await db
    .update(copyElements)
    .set({ retiredAt: now(), updatedAt: now() })
    .where(eq(copyElements.id, id))
    .returning();
  return row ?? null;
}

// ─── Performance attribution ──────────────────────────────────────────────────

export type GetElementPerformanceInput = {
  /** Specific element IDs to query. Omit to query all for the given kind. */
  elementIds?: string[];
  /** Filter by element kind (required when elementIds is omitted). */
  kind?: CopyElementKind;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
};

export type ElementPerformanceRow = {
  elementId: string;
  kind: CopyElementKind;
  totalSpendCents: number;
  totalPurchases: number;
  totalRevenueCents: number;
  avgCtr: number;
  avgRoas: number;
  avgCpaCents: number;
  adCount: number;
  avgHookRate: number;
  confidenceLowerBound: number;
};

/**
 * Aggregate ad_daily_metrics for each copy element.
 *
 * Join path:
 *   copy_elements
 *     ← creative_briefs.element_ids (jsonb containment: element_ids @> {kind_key: elementId})
 *     ← ad_creatives.brief_ref = creative_briefs.id
 *     ← ads.ad_creative_meta_id = ad_creatives.meta_id
 *     ← ad_daily_metrics.entity_meta_id = ads.meta_id
 *
 * The jsonb containment filter uses sql tagged templates — never string concatenation.
 */
export async function getElementPerformance(
  input: GetElementPerformanceInput,
): Promise<ElementPerformanceRow[]> {
  if (!isDatabaseConfigured()) return [];
  if (!input.elementIds?.length && !input.kind) {
    throw new Error("getElementPerformance: provide elementIds or kind");
  }

  const db = getDatabase();

  // Build the list of (elementId, kind) pairs to evaluate
  let targetElements: Array<{ id: string; kind: CopyElementKind }> = [];

  if (input.elementIds?.length) {
    // Fetch element rows to get their kinds
    const rows = await db
      .select({ id: copyElements.id, kind: copyElements.kind })
      .from(copyElements)
      .where(inArray(copyElements.id, input.elementIds));
    targetElements = rows as Array<{ id: string; kind: CopyElementKind }>;
  } else if (input.kind) {
    const rows = await db
      .select({ id: copyElements.id, kind: copyElements.kind })
      .from(copyElements)
      .where(and(eq(copyElements.kind, input.kind), sql`${copyElements.retiredAt} IS NULL`));
    targetElements = rows as Array<{ id: string; kind: CopyElementKind }>;
  }

  if (targetElements.length === 0) return [];

  // Map CopyElementKind → jsonb key in element_ids
  const kindToJsonbKey: Record<CopyElementKind, string> = {
    hook: "hook_id",
    body: "body_id",
    cta: "cta_id",
    visual_style: "visual_style_id",
  };

  const results: ElementPerformanceRow[] = [];

  for (const el of targetElements) {
    const jsonbKey = kindToJsonbKey[el.kind];

    // jsonb containment filter: creative_briefs.element_ids @> jsonb_build_object(key, id)
    // Using sql tagged template — no string concatenation of user data.
    const containsFilter = sql`
      ${creativeBriefs.elementIds} @> jsonb_build_object(${jsonbKey}::text, ${el.id}::text)
    `;

    const row = await db
      .select({
        adCount: sql<number>`cast(count(distinct ${ads.id}) as integer)`,
        totalSpendCents: sql<number>`cast(coalesce(sum(${adDailyMetrics.spendCents}), 0) as integer)`,
        totalPurchases: sql<number>`cast(coalesce(sum(${adDailyMetrics.purchases}), 0) as integer)`,
        totalRevenueCents: sql<number>`cast(coalesce(sum(${adDailyMetrics.revenueCents}), 0) as integer)`,
        totalClicks: sql<number>`cast(coalesce(sum(${adDailyMetrics.clicks}), 0) as integer)`,
        avgCtr: sql<number>`coalesce(avg(cast(${adDailyMetrics.ctr} as float)), 0)`,
        avgRoas: sql<number>`coalesce(avg(cast(${adDailyMetrics.roas} as float)), 0)`,
        avgCpaCents: sql<number>`coalesce(avg(${adDailyMetrics.cpaCents}), 0)`,
        avgHookRate: sql<number>`coalesce(avg(cast(${adDailyMetrics.hookRate} as float)), 0)`,
      })
      .from(copyElements)
      .innerJoin(creativeBriefs, containsFilter)
      .innerJoin(adCreatives, eq(adCreatives.briefRef, creativeBriefs.id))
      .innerJoin(ads, eq(ads.adCreativeMetaId, adCreatives.metaId))
      .innerJoin(
        adDailyMetrics,
        and(
          eq(adDailyMetrics.entityMetaId, ads.metaId),
          gte(adDailyMetrics.date, input.dateFrom),
          lte(adDailyMetrics.date, input.dateTo),
        ),
      )
      .where(eq(copyElements.id, el.id));

    const r = row[0];
    if (!r) {
      results.push({
        elementId: el.id,
        kind: el.kind,
        totalSpendCents: 0,
        totalPurchases: 0,
        totalRevenueCents: 0,
        avgCtr: 0,
        avgRoas: 0,
        avgCpaCents: 0,
        adCount: 0,
        avgHookRate: 0,
        confidenceLowerBound: 0,
      });
      continue;
    }

    const totalClicks = r.totalClicks ?? 0;
    const totalPurchases = r.totalPurchases ?? 0;
    const confidenceLowerBound = wilsonLowerBound(totalPurchases, totalClicks);

    results.push({
      elementId: el.id,
      kind: el.kind,
      totalSpendCents: r.totalSpendCents ?? 0,
      totalPurchases,
      totalRevenueCents: r.totalRevenueCents ?? 0,
      avgCtr: r.avgCtr ?? 0,
      avgRoas: r.avgRoas ?? 0,
      avgCpaCents: Math.round(r.avgCpaCents ?? 0),
      adCount: r.adCount ?? 0,
      avgHookRate: r.avgHookRate ?? 0,
      confidenceLowerBound,
    });
  }

  return results;
}

// ─── Phase 7b — Semantic Tag Helpers (APPENDED) ───────────────────────────────

import type { CreativeAssetSemanticTags } from "./schema";

/**
 * Persist semantic tags after the auto-tagger has run.
 * Called by autoTagAndPersist in @littlecolorbook/creative.
 */
export async function updateCreativeAssetSemanticTags(input: {
  id: string;
  semanticTags: CreativeAssetSemanticTags;
  taggedAt: Date;
}) {
  if (!isDatabaseConfigured()) return null;
  const db = getDatabase();
  // The semantic_tags / semantic_tagged_at columns were added via ALTER TABLE
  // in migration 0024. The Drizzle pgTable() literal hasn't been updated yet
  // (that's a future cleanup PR). We use a raw SQL update so we can reference
  // the new column names directly.
  const rows = await db.execute(sql`
    UPDATE creative_assets
       SET semantic_tags      = ${JSON.stringify(input.semanticTags)}::jsonb,
           semantic_tagged_at = ${input.taggedAt.toISOString()}::timestamptz,
           updated_at         = now()
     WHERE id = ${input.id}
     RETURNING id, semantic_tags, semantic_tagged_at, updated_at
  `);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0] ?? null;
  return row;
}

/**
 * List creative_assets where semantic_tagged_at IS NULL (untagged rows).
 * Ordered oldest-first so the backfill script processes in insertion order.
 */
export async function listUntaggedCreativeAssets(input: {
  limit?: number;
}): Promise<Array<{ id: string; gcsBucket: string; gcsObject: string; mimeType: string; tagsJson: CreativeAssetTagsJson }>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  // semantic_tagged_at is not yet in the Drizzle column map, so use raw SQL.
  const rows = await db.execute(sql`
    SELECT id, gcs_bucket, gcs_object, mime_type, tags_json
      FROM creative_assets
     WHERE semantic_tagged_at IS NULL
     ORDER BY created_at ASC
     LIMIT ${input.limit ?? 100}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row["id"]),
    gcsBucket: String(row["gcs_bucket"]),
    gcsObject: String(row["gcs_object"]),
    mimeType: String(row["mime_type"]),
    tagsJson: (row["tags_json"] as CreativeAssetTagsJson) ?? {},
  }));
}

/**
 * Find assets whose semantic_tags JSONB contains all the supplied key/value
 * pairs (PostgreSQL @> containment operator). Uses the GIN index from
 * migration 0024.
 */
export async function searchCreativeAssetsBySemanticTag(input: {
  filter: Partial<CreativeAssetSemanticTags>;
  limit?: number;
}) {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const filterJson = JSON.stringify(input.filter);
  return db
    .select()
    .from(creativeAssets)
    .where(sql`semantic_tags @> ${filterJson}::jsonb`)
    .orderBy(desc(creativeAssets.createdAt))
    .limit(input.limit ?? 50);
}

// ─── Tag Performance types ────────────────────────────────────────────────────

export type TagPerformanceResult = {
  tagKey: string;
  tagValue: string;
  adCount: number;
  totalSpendCents: number;
  totalPurchases: number;
  avgCtr: number | null;
  avgRoas: number | null;
  avgCpaCents: number | null;
  avgHookRate: number | null;
};

/**
 * Aggregate ad performance metrics for all ads whose linked creative_assets
 * have a specific semantic tag key+value.
 *
 * Join chain:
 *   ad_daily_metrics (entityMetaId=ads.metaId)
 *   → ads (adCreativeMetaId=ad_creatives.metaId)
 *   → ad_creatives (briefRef=creative_briefs.id)
 *   → creative_briefs (id=creative_assets.briefId)
 *   → creative_assets filtered by semantic_tags @> '{"tagKey":"tagValue"}'
 */
export async function getTagPerformance(input: {
  tagKey: string;
  tagValue: string;
  dateFrom: string; // ISO date YYYY-MM-DD
  dateTo: string;
}): Promise<TagPerformanceResult> {
  if (!isDatabaseConfigured()) {
    return {
      tagKey: input.tagKey,
      tagValue: input.tagValue,
      adCount: 0,
      totalSpendCents: 0,
      totalPurchases: 0,
      avgCtr: null,
      avgRoas: null,
      avgCpaCents: null,
      avgHookRate: null,
    };
  }
  const db = getDatabase();
  const filterJson = JSON.stringify({ [input.tagKey]: input.tagValue });

  const rows = await db.execute(sql`
    SELECT
      COUNT(DISTINCT adm.entity_meta_id)::int      AS ad_count,
      COALESCE(SUM(adm.spend_cents), 0)::int       AS total_spend_cents,
      COALESCE(SUM(adm.purchases), 0)::int         AS total_purchases,
      AVG(adm.ctr::float)                          AS avg_ctr,
      AVG(adm.roas::float)                         AS avg_roas,
      AVG(adm.cpa_cents::float)                    AS avg_cpa_cents,
      AVG(adm.hook_rate::float)                    AS avg_hook_rate
    FROM ad_daily_metrics adm
    JOIN ads                ON ads.meta_id              = adm.entity_meta_id
    JOIN ad_creatives       ON ad_creatives.meta_id     = ads.ad_creative_meta_id
    JOIN creative_briefs    ON creative_briefs.id       = ad_creatives.brief_ref
    JOIN creative_assets    ON creative_assets.brief_id = creative_briefs.id
    WHERE adm.date BETWEEN ${input.dateFrom} AND ${input.dateTo}
      AND creative_assets.semantic_tags @> ${filterJson}::jsonb
  `);

  const row = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};

  return {
    tagKey: input.tagKey,
    tagValue: input.tagValue,
    adCount: Number(row["ad_count"] ?? 0),
    totalSpendCents: Number(row["total_spend_cents"] ?? 0),
    totalPurchases: Number(row["total_purchases"] ?? 0),
    avgCtr: row["avg_ctr"] != null ? Number(row["avg_ctr"]) : null,
    avgRoas: row["avg_roas"] != null ? Number(row["avg_roas"]) : null,
    avgCpaCents: row["avg_cpa_cents"] != null ? Number(row["avg_cpa_cents"]) : null,
    avgHookRate: row["avg_hook_rate"] != null ? Number(row["avg_hook_rate"]) : null,
  };
}

/**
 * Like getTagPerformance but accepts a multi-key filter so you can query
 * e.g. { scene_type: 'outdoor', emotion: 'joyful' }.
 */
export async function getTagComboPerformance(input: {
  filter: Partial<CreativeAssetSemanticTags>;
  dateFrom: string;
  dateTo: string;
}): Promise<TagPerformanceResult> {
  if (!isDatabaseConfigured()) {
    return {
      tagKey: JSON.stringify(input.filter),
      tagValue: "",
      adCount: 0,
      totalSpendCents: 0,
      totalPurchases: 0,
      avgCtr: null,
      avgRoas: null,
      avgCpaCents: null,
      avgHookRate: null,
    };
  }
  const db = getDatabase();
  const filterJson = JSON.stringify(input.filter);

  const rows = await db.execute(sql`
    SELECT
      COUNT(DISTINCT adm.entity_meta_id)::int      AS ad_count,
      COALESCE(SUM(adm.spend_cents), 0)::int       AS total_spend_cents,
      COALESCE(SUM(adm.purchases), 0)::int         AS total_purchases,
      AVG(adm.ctr::float)                          AS avg_ctr,
      AVG(adm.roas::float)                         AS avg_roas,
      AVG(adm.cpa_cents::float)                    AS avg_cpa_cents,
      AVG(adm.hook_rate::float)                    AS avg_hook_rate
    FROM ad_daily_metrics adm
    JOIN ads                ON ads.meta_id              = adm.entity_meta_id
    JOIN ad_creatives       ON ad_creatives.meta_id     = ads.ad_creative_meta_id
    JOIN creative_briefs    ON creative_briefs.id       = ad_creatives.brief_ref
    JOIN creative_assets    ON creative_assets.brief_id = creative_briefs.id
    WHERE adm.date BETWEEN ${input.dateFrom} AND ${input.dateTo}
      AND creative_assets.semantic_tags @> ${filterJson}::jsonb
  `);

  const row = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};

  return {
    tagKey: JSON.stringify(input.filter),
    tagValue: "",
    adCount: Number(row["ad_count"] ?? 0),
    totalSpendCents: Number(row["total_spend_cents"] ?? 0),
    totalPurchases: Number(row["total_purchases"] ?? 0),
    avgCtr: row["avg_ctr"] != null ? Number(row["avg_ctr"]) : null,
    avgRoas: row["avg_roas"] != null ? Number(row["avg_roas"]) : null,
    avgCpaCents: row["avg_cpa_cents"] != null ? Number(row["avg_cpa_cents"]) : null,
    avgHookRate: row["avg_hook_rate"] != null ? Number(row["avg_hook_rate"]) : null,
  };
}

export type TopTagComboResult = TagPerformanceResult & {
  tagFingerprint: string;
};

/**
 * Scan all distinct semantic tag combinations appearing in ad_daily_metrics
 * within the window, compute performance per combo, and return the top N by
 * the chosen metric.
 *
 * Uses a CTE that groups by the canonical JSON text of semantic_tags. This is
 * an expensive scan — only call from admin/reporting contexts, never hot paths.
 *
 * For cpa_cents: lower is better (ASC). For roas/ctr: higher is better (DESC).
 */
export async function listTopPerformingTagCombos(input: {
  dateFrom: string;
  dateTo: string;
  metric: "roas" | "cpa_cents" | "ctr";
  limit?: number;
}): Promise<TopTagComboResult[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDatabase();
  const limitVal = input.limit ?? 20;

  // We cannot interpolate the ORDER BY direction from input.metric as a raw
  // string (SQL injection risk), so we use a fixed mapping here.
  const orderClause =
    input.metric === "cpa_cents"
      ? "avg_cpa_cents ASC NULLS LAST"
      : input.metric === "roas"
        ? "avg_roas DESC NULLS LAST"
        : "avg_ctr DESC NULLS LAST";

  // We embed the metric name only from a known-safe enum above.
  const rows = await db.execute(sql`
    WITH tagged_ads AS (
      SELECT
        adm.entity_meta_id,
        adm.spend_cents,
        adm.purchases,
        adm.ctr,
        adm.roas,
        adm.cpa_cents,
        adm.hook_rate,
        ca.semantic_tags::text AS tag_fingerprint
      FROM ad_daily_metrics adm
      JOIN ads             ON ads.meta_id             = adm.entity_meta_id
      JOIN ad_creatives    ON ad_creatives.meta_id    = ads.ad_creative_meta_id
      JOIN creative_briefs ON creative_briefs.id      = ad_creatives.brief_ref
      JOIN creative_assets ca ON ca.brief_id          = creative_briefs.id
      WHERE adm.date BETWEEN ${input.dateFrom} AND ${input.dateTo}
        AND ca.semantic_tags <> '{}'::jsonb
    ),
    grouped AS (
      SELECT
        tag_fingerprint,
        COUNT(DISTINCT entity_meta_id)::int           AS ad_count,
        COALESCE(SUM(spend_cents), 0)::int            AS total_spend_cents,
        COALESCE(SUM(purchases), 0)::int              AS total_purchases,
        AVG(ctr::float)                               AS avg_ctr,
        AVG(roas::float)                              AS avg_roas,
        AVG(cpa_cents::float)                         AS avg_cpa_cents,
        AVG(hook_rate::float)                         AS avg_hook_rate
      FROM tagged_ads
      GROUP BY tag_fingerprint
    )
    SELECT * FROM grouped
    ORDER BY ${sql.raw(orderClause)}
    LIMIT ${limitVal}
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    tagKey: "combo",
    tagValue: "",
    tagFingerprint: String(row["tag_fingerprint"] ?? ""),
    adCount: Number(row["ad_count"] ?? 0),
    totalSpendCents: Number(row["total_spend_cents"] ?? 0),
    totalPurchases: Number(row["total_purchases"] ?? 0),
    avgCtr: row["avg_ctr"] != null ? Number(row["avg_ctr"]) : null,
    avgRoas: row["avg_roas"] != null ? Number(row["avg_roas"]) : null,
    avgCpaCents: row["avg_cpa_cents"] != null ? Number(row["avg_cpa_cents"]) : null,
    avgHookRate: row["avg_hook_rate"] != null ? Number(row["avg_hook_rate"]) : null,
  }));
}
