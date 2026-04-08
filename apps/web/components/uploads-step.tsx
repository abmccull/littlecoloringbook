"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode } from "@littlecolorbook/shared";
import { useState } from "react";
import { UploadDropzone } from "./upload-dropzone";
import { trackEvent } from "./analytics-provider";

type UploadsStepProps = {
  deliveryMode?: string;
  orderId?: string;
  selectedOffer?: string;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
};

export function UploadsStep({ deliveryMode, orderId, selectedOffer }: UploadsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!orderId) {
    return (
      <section className="builder-card">
        <span className="pill">Album uploads</span>
        <h1>Start from the builder first.</h1>
        <p className="lede">This step now expects a persisted order draft so uploads can be tied to a real order ID.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/create">
            Go to Builder
          </Link>
        </div>
      </section>
    );
  }

  const resolvedMode = deliveryMode === "print" ? "print" : "pdf";
  const offer = getOfferByCode(selectedOffer ?? defaultOffer);

  async function handleCheckout() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedOffer: offer.code,
        }),
      });

      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Could not start checkout.");
      }

      trackEvent("checkout_started", {
        deliveryMode: resolvedMode,
        orderId,
        selectedOffer: offer.code,
      });

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const printHref = `/create/shipping?orderId=${encodeURIComponent(orderId)}&selectedOffer=${encodeURIComponent(offer.code)}`;

  return (
    <section className="builder-card">
      <span className="pill">Album uploads</span>
      <h1>Upload the photo set.</h1>
      <p className="lede">
        Uploads are now tied to order <strong>{orderId}</strong>. The next stage will add automated blur checks, duplicate detection, and moderation before generation begins.
      </p>
      <UploadDropzone
        title="Upload at least 10 photos"
        hint="Signed uploads are already wired. This pass finishes the order-to-checkout flow so the same order ID carries through payment and the portal."
        entityType="order"
        entityId={orderId}
        allowMultiple
        buttonLabel="Choose Album Photos"
      />
      <div className="surface">
        <span className="pill">Order summary</span>
        <h3>{offer.title}</h3>
        <p className="muted">{offer.priceLabel}</p>
      </div>
      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}
      <div className="hero-actions">
        {resolvedMode === "print" ? (
          <Link
            className="button button-primary"
            href={printHref}
            onClick={() => {
              trackEvent("shipping_step_started", {
                orderId,
                selectedOffer: offer.code,
              });
            }}
          >
            Continue to Shipping
          </Link>
        ) : (
          <button className="button button-primary" disabled={isSubmitting} type="button" onClick={handleCheckout}>
            {isSubmitting ? "Starting checkout..." : "Continue to Checkout"}
          </button>
        )}
        <Link className="button button-secondary" href={`/order/${encodeURIComponent(orderId)}`}>
          View Order Portal
        </Link>
      </div>
    </section>
  );
}
