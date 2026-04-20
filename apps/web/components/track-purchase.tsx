"use client";

import { useEffect } from "react";
import { trackEvent } from "./analytics-provider";

type TrackPurchaseProps = {
  orderId: string | null | undefined;
  valueCents: number | null | undefined;
  currency: string | null | undefined;
  offerCode: string | null | undefined;
};

/**
 * Fires the browser Meta pixel Purchase event once per order, using a
 * deterministic event_id (`purchase_${orderId}`) that matches the
 * server-side CAPI Purchase event sent from the Stripe webhook. Meta
 * deduplicates the pixel+CAPI pair on event_id.
 *
 * skipCapiEnqueue is true — the server webhook already handles CAPI
 * for the Purchase event. Firing client-side CAPI here would collide
 * on the shared event_id.
 */
export function TrackPurchase({ orderId, valueCents, currency, offerCode }: TrackPurchaseProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!orderId || valueCents == null || !currency) return;

    const firedKey = `purchase-fired:${orderId}`;
    try {
      if (window.sessionStorage.getItem(firedKey) === "1") return;
      window.sessionStorage.setItem(firedKey, "1");
    } catch {
      // Session storage unavailable — still fire, accept possible duplicate
      // on page refresh. Deduplication on Meta's side is event_id-based,
      // so a duplicate pixel fire with the same event_id is harmless.
    }

    trackEvent(
      "Purchase",
      {
        value: valueCents / 100,
        currency: currency.toUpperCase(),
        content_ids: offerCode ? [offerCode] : [],
        content_type: "product",
        order_id: orderId,
      },
      {
        eventId: `purchase_${orderId}`,
        skipCapiEnqueue: true,
      },
    );
  }, [orderId, valueCents, currency, offerCode]);

  return null;
}
