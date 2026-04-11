"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { trackEvent } from "./analytics-provider";

type SampleProcessingPanelProps = {
  orderId: string;
  readyHref: string;
  status: string;
  uploadCount: number;
};

type StartSampleResponse = {
  accepted?: boolean;
  error?: string;
  jobQueued?: boolean;
};

export function SampleProcessingPanel({ orderId, readyHref, status, uploadCount }: SampleProcessingPanelProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [isAwaitingGeneration, setIsAwaitingGeneration] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isProcessing = status === "preprocessing" || status === "generating" || status === "qa_review";
  const isReady = status === "pdf_ready";
  const isWorking = isProcessing || isAwaitingGeneration;

  useEffect(() => {
    if (isProcessing || isReady || uploadCount === 0) {
      setIsAwaitingGeneration(false);
    }
  }, [isProcessing, isReady, uploadCount]);

  useEffect(() => {
    if (!isWorking) {
      return;
    }

    const refreshTimer = window.setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 4000);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [isWorking, router, status]);

  async function handleStart() {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/samples/${orderId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as StartSampleResponse;

      if (!response.ok || !payload.jobQueued) {
        throw new Error(payload.error ?? "We couldn't start your free page. Please try again.");
      }

      setIsAwaitingGeneration(true);
      trackEvent("sample_generation_started", {
        orderId,
        uploadCount,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't start your free page. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="upload-stack">
      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      {isReady ? (
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={() => router.push(readyHref)}>
            See My Free Page
          </button>
        </div>
      ) : null}

      {!isReady && !isWorking ? (
        <div className="hero-actions">
          <button className="button button-primary" disabled={isStarting || uploadCount === 0} type="button" onClick={handleStart}>
            {isStarting ? "Creating your page..." : "Create My Free Page"}
          </button>
        </div>
      ) : null}

      {isWorking ? (
        <div aria-live="polite" className="processing-note surface">
          <span className="pill pill-sky">{isProcessing ? "Auto-updating" : "Getting started"}</span>
          <div className="stack-tight">
            <strong>{isProcessing ? "We will keep checking for you." : "We are getting your free page started."}</strong>
            <p className="muted">
              Stay here for a moment. This screen refreshes on its own and moves you forward as soon as the free page is ready.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
