import { createHash } from "node:crypto";
import { buildNormalizedUserData, sendCapiEvent, type CapiEventInput } from "@littlecolorbook/meta";
import {
  getCapiEventByEventId,
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

async function dispatchRefundCapiEventRow(rowId: string) {
  const dispatched = await enqueueInternalJob({
    job: "process-capi-event",
    payload: { capiEventId: rowId },
    fallbackToDirectOnQueueError: true,
  });

  if (!dispatched.accepted) {
    await updateCapiEventStatus(rowId, {
      status: "failed",
      errorMessage: "Failed to dispatch refund CAPI event for delivery",
    });
    throw new Error("Failed to dispatch refund CAPI event for delivery");
  }
}

/**
 * Fire a Meta CAPI Refund event so downstream reporting and diagnostics
 * can see revenue reversals tied back to the original order. Sent with a
 * negative `value` referencing the original order. Deterministic
 * event_id (`refund_${refundId}`) keeps webhook replays and duplicate
 * Stripe refund notifications idempotent on our side.
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

  const capiEvent: CapiEventInput = {
    event_name: "Refund",
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      // Negative value keeps refund reporting tied to the original order.
      value: -(refundAmountCents / 100),
      currency,
      order_id: orderId,
      refund_id: refundId,
    },
  };
  if (eventSourceUrl) capiEvent.event_source_url = eventSourceUrl;

  if (!isDatabaseConfigured()) {
    await sendCapiEvent(capiEvent);
    return null;
  }

  const existing = await getCapiEventByEventId(eventId);
  if (existing) {
    if (existing.status === "failed") {
      await updateCapiEventStatus(existing.id, {
        status: "queued",
        errorMessage: null,
      });
      await dispatchRefundCapiEventRow(existing.id);
    }
    return existing;
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
    payloadJson: capiEvent as unknown as Record<string, unknown>,
  });

  if (!row) {
    throw new Error("Failed to persist refund CAPI event before dispatch");
  }

  try {
    await dispatchRefundCapiEventRow(row.id);
  } catch (error) {
    await updateCapiEventStatus(row.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Failed to dispatch refund CAPI event",
    });
    throw error;
  }

  return row;
}
