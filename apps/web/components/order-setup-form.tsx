"use client";

import { useState } from "react";
import { UploadDropzone } from "./upload-dropzone";
import { trackEvent } from "./analytics-provider";

type SetupStep = "upload" | "customize" | "confirm";

type OrderSetupFormProps = {
  orderId: string;
  portalToken: string;
  deliveryMode: "pdf" | "print";
  designCount: number;
  offerTitle: string;
  initialChildFirstName: string;
  initialCoverStyle: string;
  initialDedicationText: string;
  existingUploads: Array<{
    fileName: string;
    objectPath?: string;
    status: "uploaded" | "failed";
  }>;
  portalHref: string;
};

type UploadStats = {
  total: number;
  uploaded: number;
  failed: number;
  isUploading: boolean;
};

const coverStyleCards: Record<string, { label: string; description: string; toneClass: string }> = {
  storybook: {
    label: "Storybook",
    description: "Vintage and giftable. Ornamental corners, serif typography, warm tones.",
    toneClass: "cover-style-storybook",
  },
  sunshine: {
    label: "Sunshine",
    description: "Bright and playful. Bold colors, cheerful sun motifs, rounded type.",
    toneClass: "cover-style-sunshine",
  },
  crayon: {
    label: "Crayon",
    description: "Handmade feel. Thick dashed borders, hand-drawn doodles, kid-friendly.",
    toneClass: "cover-style-crayon",
  },
  minimal: {
    label: "Minimal",
    description: "Modern and clean. No ornaments, generous whitespace, editorial type.",
    toneClass: "cover-style-minimal",
  },
};

const stepLabels: Record<SetupStep, string> = {
  upload: "Photos",
  customize: "Customize",
  confirm: "Start",
};

const steps: SetupStep[] = ["upload", "customize", "confirm"];

export function OrderSetupForm({
  orderId,
  portalToken,
  deliveryMode,
  designCount,
  offerTitle,
  initialChildFirstName,
  initialCoverStyle,
  initialDedicationText,
  existingUploads,
  portalHref,
}: OrderSetupFormProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>("upload");
  const [uploadStats, setUploadStats] = useState<UploadStats>({
    total: 0,
    uploaded: 0,
    failed: 0,
    isUploading: false,
  });
  const [childFirstName, setChildFirstName] = useState(initialChildFirstName);
  const [coverStyle, setCoverStyle] = useState(initialCoverStyle || "storybook");
  const [dedicationText, setDedicationText] = useState(initialDedicationText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const existingUploadedCount = existingUploads.filter((u) => u.status === "uploaded").length;
  const newUploadedCount = uploadStats.uploaded;
  const totalUploadedCount = existingUploadedCount + newUploadedCount;
  const hasEnoughUploads = totalUploadedCount >= 1;
  const isPrint = deliveryMode === "print";
  const currentStepIndex = steps.indexOf(currentStep);

  function goToStep(step: SetupStep) {
    setCurrentStep(step);
    setErrorMessage(null);
  }

  async function handleStartGeneration() {
    setIsSubmitting(true);
    setErrorMessage(null);

    trackEvent("setup_generation_started", {
      orderId,
      deliveryMode,
      totalUploadedCount,
      coverStyle,
    });

    try {
      const response = await fetch(`/api/orders/${orderId}/start-generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portalToken,
          childFirstName: childFirstName.trim() || undefined,
          coverStyle,
          dedicationText: dedicationText.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not start your book. Please try again.");
      }

      window.location.href = portalHref;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="builder-card">
      <div className="builder-progress-shell">
        <div className="builder-progress-top">
          <div className="builder-progress-side builder-progress-side-left">
            {currentStepIndex > 0 ? (
              <button
                className="builder-progress-link"
                type="button"
                onClick={() => goToStep(steps[currentStepIndex - 1]!)}
              >
                <span aria-hidden="true">←</span>
                <strong>{stepLabels[steps[currentStepIndex - 1]!]}</strong>
              </button>
            ) : (
              <span className="builder-progress-placeholder builder-progress-placeholder-left">
                <strong>Order confirmed</strong>
              </span>
            )}
          </div>
          <div className="builder-progress-current">
            <span className="builder-progress-count">
              {currentStepIndex + 1}/{steps.length}
            </span>
            <strong>{stepLabels[currentStep]}</strong>
          </div>
          <div className="builder-progress-side builder-progress-side-right">
            {currentStep === "upload" && hasEnoughUploads && !uploadStats.isUploading ? (
              <button
                className="builder-progress-action"
                type="button"
                onClick={() => goToStep("customize")}
              >
                <strong>Customize</strong>
                <span aria-hidden="true">→</span>
              </button>
            ) : currentStep === "customize" ? (
              <button
                className="builder-progress-action"
                type="button"
                onClick={() => goToStep("confirm")}
              >
                <strong>Start</strong>
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <span className="builder-progress-placeholder" />
            )}
          </div>
        </div>
        <div aria-hidden="true" className="builder-progress-track">
          <span style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="upload-stack">
        {currentStep === "upload" ? (
          <>
            <div className="builder-step-intro">
              <span className="pill pill-mint">Payment confirmed</span>
              <h1>Upload your photos to build the book.</h1>
              <p className="lede">
                Upload up to {designCount} photos. One photo per page. The clearest faces and
                favorite moments turn into the best coloring pages.
              </p>
            </div>

            <UploadDropzone
              title={`Add up to ${designCount} photos`}
              hint="Clear faces, pets, and family moments work best. Add several at once from your camera roll."
              entityType="order"
              entityId={orderId}
              allowMultiple
              uploadKind="original"
              buttonLabel="Choose Photos"
              initialUploads={existingUploads}
              onUploadStatsChange={setUploadStats}
            />

            {hasEnoughUploads && !uploadStats.isUploading ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => goToStep("customize")}
              >
                Continue to Customize
              </button>
            ) : !hasEnoughUploads ? (
              <p className="muted">Add at least one photo to continue.</p>
            ) : null}
          </>
        ) : null}

        {currentStep === "customize" ? (
          <>
            <div className="builder-step-intro">
              <h1>Personalize the cover.</h1>
              <p className="lede">
                Add the name for the cover and choose the style that fits the memories inside.
              </p>
            </div>

            <div className="form-grid">
              <label>
                <span className="muted">Name on the cover</span>
                <input
                  autoComplete="given-name"
                  className="input"
                  name="childFirstName"
                  placeholder="Mila"
                  type="text"
                  value={childFirstName}
                  onChange={(event) => setChildFirstName(event.target.value)}
                />
              </label>

              <label>
                <span className="muted">Dedication (optional)</span>
                <textarea
                  className="textarea"
                  name="dedicationText"
                  placeholder="For rainy afternoons, birthday mornings, and grandma visits."
                  value={dedicationText}
                  onChange={(event) => setDedicationText(event.target.value)}
                />
              </label>
            </div>

            {isPrint ? (
              <div className="upload-stack">
                <div className="stack-tight">
                  <strong>Choose a cover style.</strong>
                  <p className="muted">Pick the mood that fits the memories inside.</p>
                </div>
                <div className="cover-style-grid">
                  {Object.entries(coverStyleCards).map(([styleCode, style]) => (
                    <button
                      key={styleCode}
                      className={`cover-style-card ${style.toneClass}${coverStyle === styleCode ? " active" : ""}`}
                      type="button"
                      onClick={() => setCoverStyle(styleCode)}
                    >
                      <span className="pill pill-sun">{style.label}</span>
                      <strong>{style.label}</strong>
                      <p>{style.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              className="button button-primary"
              type="button"
              onClick={() => goToStep("confirm")}
            >
              Continue to Review
            </button>
          </>
        ) : null}

        {currentStep === "confirm" ? (
          <>
            <div className="builder-step-intro">
              <h1>Ready to create your coloring book.</h1>
              <p className="lede">
                Everything looks good. Hit the button below and we will start turning your photos
                into coloring pages right away.
              </p>
            </div>

            <div className="surface selection-summary">
              <span className="pill pill-mint">Your order summary</span>
              <h3>{offerTitle}</h3>
              <div className="builder-review-list">
                <div className="builder-review-line">
                  <span className="muted">Format</span>
                  <strong>
                    {deliveryMode === "print" ? "Giftable Spiral Book + PDF" : "Print Tonight PDF"}
                  </strong>
                </div>
                <div className="builder-review-line">
                  <span className="muted">Pages</span>
                  <strong>{designCount} coloring pages</strong>
                </div>
                <div className="builder-review-line">
                  <span className="muted">Photos ready</span>
                  <strong>{totalUploadedCount} uploaded</strong>
                </div>
                {childFirstName.trim() ? (
                  <div className="builder-review-line">
                    <span className="muted">Cover name</span>
                    <strong>{childFirstName.trim()}</strong>
                  </div>
                ) : null}
                {isPrint ? (
                  <div className="builder-review-line">
                    <span className="muted">Cover style</span>
                    <strong>{coverStyleCards[coverStyle]?.label ?? coverStyle}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="surface builder-review-note">
              <span className="pill pill-sky">What happens next</span>
              <h3>We start making your pages right away.</h3>
              <p className="muted">
                {deliveryMode === "print"
                  ? "Your pages will be built first, then assembled into the spiral book and sent to print. You will get an email when each step is done."
                  : "Your PDF will be ready as soon as the pages are finished. You will get an email with the download link when it is done."}
              </p>
            </div>

            {errorMessage ? (
              <div className="status-banner status-banner-warning" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="button button-primary"
              disabled={isSubmitting}
              type="button"
              onClick={handleStartGeneration}
            >
              {isSubmitting ? "Starting..." : "Create My Coloring Book"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
