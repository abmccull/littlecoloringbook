"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isProcessing = status === "preprocessing" || status === "generating" || status === "qa_review";
  const isReady = status === "pdf_ready";

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
        throw new Error(payload.error ?? "Could not start sample generation.");
      }

      trackEvent("sample_generation_started", {
        orderId,
        uploadCount,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start sample generation.");
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
            View Your Sample
          </button>
        </div>
      ) : null}

      {!isReady && !isProcessing ? (
        <div className="hero-actions">
          <button className="button button-primary" disabled={isStarting || uploadCount === 0} type="button" onClick={handleStart}>
            {isStarting ? "Starting generation..." : "Generate My Free Sample"}
          </button>
          <button className="button button-secondary" type="button" onClick={() => router.refresh()}>
            Refresh Status
          </button>
        </div>
      ) : null}

      {isProcessing ? (
        <div className="hero-actions">
          <button className="button button-secondary" type="button" onClick={() => router.refresh()}>
            Refresh Status
          </button>
        </div>
      ) : null}
    </div>
  );
}
