import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { buildNormalizedUserData } from "@littlecolorbook/meta";
import { insertCapiEvent, isDatabaseConfigured } from "@littlecolorbook/db";
import { enqueueCapiEvent } from "@littlecolorbook/queue";

function splitName(name: string | null | undefined) {
  if (!name) return { firstName: null as string | null, lastName: null as string | null };
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts[parts.length - 1] ?? null };
}

export async function enqueuePurchaseCapiEvent({
  orderId,
  session,
  eventSourceUrl,
}: {
  orderId: string;
  session: Stripe.Checkout.Session;
  eventSourceUrl?: string;
}) {
  if (!isDatabaseConfigured()) return null;

  const { firstName, lastName } = splitName(session.customer_details?.name);
  const address = session.customer_details?.address ?? null;

  const userData = buildNormalizedUserData({
    email: session.customer_details?.email ?? null,
    phone: session.customer_details?.phone ?? null,
    firstName,
    lastName,
    city: address?.city ?? null,
    state: address?.state ?? null,
    zip: address?.postal_code ?? null,
    country: address?.country ?? null,
    externalId: orderId,
  });

  const eventId = `purchase_${orderId}`;
  const valueCents = session.amount_total ?? 0;
  const currency = (session.currency ?? "usd").toUpperCase();
  const offerCode = session.metadata?.offerCode ?? session.metadata?.selectedOfferCode ?? null;
  const eventTime = new Date();

  const payloadJson: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      value: valueCents / 100,
      currency,
      content_ids: offerCode ? [offerCode] : [],
      content_type: "product",
      order_id: orderId,
    },
  };
  if (eventSourceUrl) payloadJson.event_source_url = eventSourceUrl;

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(userData, Object.keys(userData).sort()))
    .digest("hex")
    .slice(0, 16);

  const row = await insertCapiEvent({
    id: `capi_${eventId}`,
    eventId,
    eventName: "Purchase",
    eventTime,
    actionSource: "website",
    userDataFingerprint: fingerprint,
    payloadJson,
  });

  if (row) {
    enqueueCapiEvent(row.id).catch((err: unknown) => {
      console.error("[capi-purchase] failed to enqueue BullMQ job", err);
    });
  }

  return row;
}
