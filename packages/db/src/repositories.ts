import crypto from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  getNormalizedOrderQuantity,
  getOfferByCode,
  getOfferSubtotalForQuantity,
  normalizeCopyNames,
  normalizeCoverStyle,
  normalizePrintBundleCode,
} from "@littlecolorbook/shared";
import { getDatabase, isDatabaseConfigured } from "./client";
import {
  broadcastSends,
  customers,
  customerUserLinks,
  emailSends,
  emailSequenceStates,
  orderAddresses,
  orderEvents,
  orders,
  portalTokens,
  shippingQuotes,
  stripeWebhookEvents,
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

async function appendOrderEvent(orderId: string, eventType: string, details: Record<string, unknown> | null = null) {
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
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
  promptVersion?: string | null;
  cleanupVersion?: string | null;
}) {
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
      copyNames: null,
      childFirstName: "Mila",
      dedicationText: "Made for rainy afternoons.",
      subtotalCents: 2900,
      totalCents: 2900,
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
        details: { totalCents: 2900 },
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
        ne(orders.status, "draft"),
      ),
    );

  return result[0]?.total ?? 0;
}

export async function countSamplesByIp(ip: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const db = getDatabase();
  const result = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        eq(orders.clientIp, ip),
        eq(orders.orderType, "sample"),
        ne(orders.status, "draft"),
      ),
    );

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
        ne(orders.status, "draft"),
      ),
    );

  return result[0]?.total ?? 0;
}

/**
 * Returns the order ID of an existing completed sample order for the given email,
 * or null if none exists. The raw portal token cannot be recovered (only the SHA-256
 * hash is stored), so we return the order ID to allow building a support link.
 */
export async function findExistingSampleOrderId(email: string): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const db = getDatabase();

  const customer = await db.query.customers.findFirst({
    where: eq(customers.email, normalizedEmail),
  });

  if (!customer) {
    return null;
  }

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.customerId, customer.id),
      eq(orders.orderType, "sample"),
      ne(orders.status, "draft"),
    ),
    orderBy: [desc(orders.createdAt)],
  });

  return order?.id ?? null;
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
