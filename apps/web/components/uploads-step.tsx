"use client";

import Link from "next/link";
import { defaultOffer, getOfferByCode, type OfferCode } from "@littlecolorbook/shared";
import { getConsumerOffer } from "../lib/consumer-content";
import { useEffect, useState } from "react";
import { AddOnsCheckoutPanel } from "./add-ons-checkout-panel";
import { UploadDropzone } from "./upload-dropzone";
import { trackBuyerJourneyStage, trackEvent } from "./analytics-provider";

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

export function UploadsStep({ deliveryMode, orderId, selectedOffer, initialUploadedCount = 0, initialUploads = [] }: UploadsStepProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(initialUploadedCount);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddOns, setShowAddOns] = useState(false);

  if (!orderId) {
    return (
      <section className="builder-card">
        <span className="pill pill-sun">Photo upload</span>
        <h1>Pick the book first, then add the photos.</h1>
        <p className="lede">Once you choose the size, this becomes the step where your camera roll turns into the real book.</p>
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

  useEffect(() => {
    if (!orderId || !uploadsReady) {
      return;
    }

    trackBuyerJourneyStage(
      "full_upload_completed",
      {
        orderId,
        deliveryMode: resolvedMode,
        selectedOffer: offer.code,
        uploadedCount,
        requiredUploads,
        surface: "uploads_step",
      },
      {
        onceKey: `full-upload-completed:${orderId}`,
      },
    );
  }, [offer.code, orderId, requiredUploads, resolvedMode, uploadedCount, uploadsReady]);

  function handleCheckout() {
    if (!uploadsReady) {
      setErrorMessage(`Add all ${requiredUploads} photos before you head to checkout.`);
      return;
    }

    setErrorMessage(null);
    trackEvent("add_ons_panel_opened", {
      deliveryMode: resolvedMode,
      orderId,
      selectedOffer: offer.code,
      surface: "uploads_step",
    });
    setShowAddOns(true);
  }

  const printHref = `/create/shipping?orderId=${encodeURIComponent(orderId)}&selectedOffer=${encodeURIComponent(offer.code)}`;

  return (
    <section className="builder-card">
      <span className="pill pill-sun">Photo upload</span>
      <h1>Add the photos that tell this version of the story.</h1>
      <p className="lede">
        Upload {requiredUploads} photos for this book. Think favorite faces, pets, birthdays, trips, and the everyday moments your child will recognize right away.
      </p>

      <div className="progress-callout">
        <span className="pill pill-sky">Step 2</span>
        <div className="status-banner-copy">
          <strong>This is the part where the book becomes real.</strong>
          <p className="muted">
            {uploadsReady
              ? "You have enough photos. Review the summary below, then keep moving toward checkout."
              : `Add ${photosRemaining} more ${photosRemaining === 1 ? "photo" : "photos"} to keep going.`}
          </p>
        </div>
      </div>

      <UploadDropzone
        title={`Upload ${requiredUploads} photos`}
        hint={`Use the clearest favorites first: kids playing together, pet moments, birthday shots, trips, and close-up portraits all work well. We only need ${requiredUploads} ready to keep moving.`}
        entityType="order"
        entityId={orderId}
        allowMultiple
        buttonLabel="Choose Photos From My Phone"
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
            ? `${uploadedCount} photos are ready for this book.`
          : `${uploadedCount} of ${requiredUploads} photos added so far.`}
        </p>
      </div>

      {errorMessage ? (
        <div className="status-banner status-banner-warning" role="alert">
          <div className="status-banner-copy">
            <strong>You're almost there.</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {showAddOns && resolvedMode === "pdf" ? (
        <div className="upload-stack">
          <div className="status-banner status-banner-compact">
            <span className="pill pill-mint">One more step</span>
            <div className="status-banner-copy">
              <strong>Review these options before checkout.</strong>
              <p>Skip them by scrolling to the checkout button below if you want to keep moving.</p>
            </div>
          </div>
          <AddOnsCheckoutPanel
            orderId={orderId}
            selectedOffer={offer.code}
            uploadedCount={uploadedCount}
          />
        </div>
      ) : (
        <div className="hero-actions hero-actions-mobile-bar">
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
            <button className="button button-primary" disabled={isUploading || !uploadsReady} type="button" onClick={handleCheckout}>
              Go to Secure Checkout
            </button>
          )}
          <Link className="button button-secondary" href={`/create?offer=${encodeURIComponent(offer.code)}`}>
            Back to sizes
          </Link>
        </div>
      )}
    </section>
  );
}
