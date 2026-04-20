import { createHash } from "node:crypto";
import { buildNormalizedUserData, sendCapiEvent, type CapiEventInput } from "@littlecolorbook/meta";
import {
  insertCapiEvent,
  isDatabaseConfigured,
  updateCapiEventStatus,
  getOrderPortalSummaryByOrderId,
} from "@littlecolorbook/db";
import { enqueueInternalJob } from "./internal-jobs";

function splitName(name: string | null | undefined) {
  if (!name) return { firstName: null as string | null, lastName: null as string | null };
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts[parts.length - 1] ?? null };
}

/**
 * Fire a Meta CAPI Refund event so Value Optimization stops counting
 * refunded revenue. Sent with a negative `value` referencing the
 * original order. Deterministic event_id (`refund_${refundId}`) makes
 * retries safe and Meta's side idempotent.
 *
 * Best-effort: failure is logged but must not disrupt local refund
 * reconciliation. Never expose refund amount or this event to the
 * customer.
 */
export async function enqueueRefundCapiEvent({
  orderId,
  refundId,
  refundAmountCents,
  currency = "USD",
  eventSourceUrl,
}: {
  orderId: string;
  refundId: string;
  refundAmountCents: number;
  currency?: string;
  eventSourceUrl?: string;
}) {
  if (!refundAmountCents || refundAmountCents <= 0) return null;

  const summary = isDatabaseConfigured() ? await getOrderPortalSummaryByOrderId(orderId) : null;
  const customer = summary?.customer ?? null;
  const address = summary?.shippingAddress ?? null;
  const { firstName, lastName } = splitName(customer?.firstName);

  const userData = buildNormalizedUserData({
    email: customer?.email ?? null,
    phone: customer?.phone ?? null,
    firstName,
    lastName,
    city: address?.city ?? null,
    state: address?.state ?? null,
    zip: address?.postalCode ?? null,
    country: address?.countryCode ?? null,
    externalId: orderId,
  });

  const eventId = `refund_${refundId}`;
  const eventTime = new Date();

  const payloadJson: Record<string, unknown> = {
    event_name: "Refund",
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      // Negative value signals a revenue reversal. Meta Value Optimization
      // reads this to adjust expected revenue for the corresponding
      // audience pattern.
      value: -(refundAmountCents / 100),
      currency,
      order_id: orderId,
      refund_id: refundId,
    },
  };
  if (eventSourceUrl) payloadJson.event_source_url = eventSourceUrl;

  const capiEvent = payloadJson as CapiEventInput;

  if (!isDatabaseConfigured()) {
    await sendCapiEvent(capiEvent);
    return null;
  }

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(userData, Object.keys(userData).sort()))
    .digest("hex")
    .slice(0, 16);

  const row = await insertCapiEvent({
    id: `capi_${eventId}`,
    eventId,
    eventName: "Refund",
    eventTime,
    actionSource: "website",
    userDataFingerprint: fingerprint,
    payloadJson,
  });

  if (!row) {
    throw new Error("Failed to persist refund CAPI event before dispatch");
  }

  try {
    const dispatched = await enqueueInternalJob({
      job: "process-capi-event",
      payload: { capiEventId: row.id },
      fallbackToDirectOnQueueError: true,
    });

    if (!dispatched.accepted) {
      await updateCapiEventStatus(row.id, {
        status: "failed",
        errorMessage: "Failed to dispatch refund CAPI event for delivery",
      });
      throw new Error("Failed to dispatch refund CAPI event for delivery");
    }
  } catch (error) {
    await updateCapiEventStatus(row.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Failed to dispatch refund CAPI event",
    });
    throw error;
  }

  return row;
}
