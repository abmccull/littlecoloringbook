"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode, type OfferCode } from "@littlecolorbook/shared";
import { getConsumerOffer } from "../lib/consumer-content";
import { useState } from "react";
import { UploadDropzone } from "./upload-dropzone";
import { trackEvent } from "./analytics-provider";

type UploadsStepProps = {
  deliveryMode?: string;
  orderId?: string;
  selectedOffer?: string;
  initialUploadedCount?: number;
  initialUploads?: Array<{
    fileName: string;
    objectPath?: string;
    status: "uploaded" | "failed";
  }>;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
};

export function UploadsStep({ deliveryMode, orderId, selectedOffer, initialUploadedCount = 0, initialUploads = [] }: UploadsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(initialUploadedCount);
  const [isUploading, setIsUploading] = useState(false);

  if (!orderId) {
    return (
      <section className="builder-card">
        <span className="pill pill-sun">Photo upload</span>
        <h1>Start by choosing the book you want to make.</h1>
        <p className="lede">Once your book is picked, this step becomes your guided upload screen for the real photos.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/create">
            Choose My Book
          </Link>
        </div>
      </section>
    );
  }

  const resolvedMode = deliveryMode === "print" ? "print" : "pdf";
  const offer = getOfferByCode(selectedOffer ?? defaultOffer);
  const merchOffer = getConsumerOffer(offer.format === "print" ? (`pdf-${offer.designs}` as OfferCode) : offer.code);
  const requiredUploads = offer.designs;
  const uploadsReady = uploadedCount >= requiredUploads;
  const photosRemaining = Math.max(requiredUploads - uploadedCount, 0);

  async function handleCheckout() {
    if (!uploadsReady) {
      setErrorMessage(`Add all ${requiredUploads} photos before checkout.`);
      return;
    }

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
      <span className="pill pill-sun">Photo upload</span>
      <h1>Add the photos that will become your child's book.</h1>
      <p className="lede">
        Upload {requiredUploads} photos for this book. Clear faces, pets, birthdays, vacations, and everyday family moments usually turn into the best pages.
      </p>

      <div className="progress-callout">
        <span className="pill pill-sky">Step 2</span>
        <div className="stack-tight">
          <strong>You're building the real book now.</strong>
          <p className="muted">
            {uploadsReady
              ? "Your photo count looks good. Review the summary below, then keep moving to checkout."
              : `Add ${photosRemaining} more ${photosRemaining === 1 ? "photo" : "photos"} to unlock checkout.`}
          </p>
        </div>
      </div>

      <UploadDropzone
        title={`Upload ${requiredUploads} photos`}
        hint={`We recommend a mix of close-up kid photos, siblings, pets, and family moments. You can upload more than ${requiredUploads}, but checkout unlocks once the first ${requiredUploads} are ready.`}
        entityType="order"
        entityId={orderId}
        allowMultiple
        buttonLabel="Choose My Photos"
        initialUploads={initialUploads}
        onUploadStatsChange={(stats) => {
          setUploadedCount(stats.uploaded);
          setIsUploading(stats.isUploading);
          if (stats.uploaded >= requiredUploads) {
            setErrorMessage(null);
          }
        }}
      />

      <div className="surface selection-summary">
        <span className={`pill ${resolvedMode === "print" ? "pill-coral" : "pill-sky"}`}>
          {resolvedMode === "print" ? "Giftable Spiral Book" : "Print Tonight PDF"}
        </span>
        <h3>{merchOffer.title}</h3>
        <p className="muted">{offer.priceLabel}</p>
        <p className="mini-note">
          {uploadsReady
            ? `${uploadedCount} photos ready for your book.`
            : `${uploadedCount} of ${requiredUploads} photos uploaded so far.`}
        </p>
      </div>

      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      <div className="hero-actions">
        {resolvedMode === "print" ? (
          <Link
            className="button button-primary"
            href={printHref}
            aria-disabled={!uploadsReady || isUploading}
            onClick={(event) => {
              if (!uploadsReady || isUploading) {
                event.preventDefault();
                return;
              }
              trackEvent("shipping_step_started", {
                orderId,
                selectedOffer: offer.code,
              });
            }}
          >
            Continue to Delivery
          </Link>
        ) : (
          <button className="button button-primary" disabled={isSubmitting || isUploading || !uploadsReady} type="button" onClick={handleCheckout}>
            {isSubmitting ? "Starting checkout..." : "Continue to Secure Checkout"}
          </button>
        )}
        <Link className="button button-secondary" href={`/create?offer=${encodeURIComponent(offer.code)}`}>
          Change Book Choice
        </Link>
      </div>
    </section>
  );
}
