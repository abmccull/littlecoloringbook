"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { galleryExamples } from "../lib/consumer-content";
import { trackEvent } from "./analytics-provider";
import { GalleryCarousel } from "./gallery-carousel";

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

const ESTIMATED_SECONDS = 90;

const STATUS_PROGRESS: Record<string, number> = {
  preprocessing: 25,
  generating: 55,
  qa_review: 90,
  pdf_ready: 100,
};

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 5) return "Almost done...";
  if (seconds <= 15) return "About 15 seconds left";
  if (seconds <= 30) return "About 30 seconds left";
  if (seconds <= 60) return "About 1 minute left";
  const mins = Math.ceil(seconds / 60);
  return `About ${mins} minute${mins > 1 ? "s" : ""} left`;
}

export function SampleProcessingPanel({ orderId, readyHref, status, uploadCount }: SampleProcessingPanelProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [isAwaitingGeneration, setIsAwaitingGeneration] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const isProcessing = status === "preprocessing" || status === "generating" || status === "qa_review";
  const isReady = status === "pdf_ready";
  const isWorking = isProcessing || isAwaitingGeneration;
  const showProgress = isWorking || isStarting;

  // Progress: use whichever is higher — time-based or status-based
  const timeProgress = Math.min((elapsed / ESTIMATED_SECONDS) * 95, 95);
  const statusProgress = STATUS_PROGRESS[status] ?? 0;
  const progress = isReady ? 100 : Math.max(timeProgress, statusProgress, showProgress ? 3 : 0);
  const remaining = Math.max(0, ESTIMATED_SECONDS - elapsed);

  useEffect(() => {
    if (isProcessing || isReady || uploadCount === 0) {
      setIsAwaitingGeneration(false);
    }
  }, [isProcessing, isReady, uploadCount]);

  // Auto-refresh every 4s while working
  useEffect(() => {
    if (!isWorking) return;

    const refreshTimer = window.setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 4000);

    return () => window.clearTimeout(refreshTimer);
  }, [isWorking, router, status]);

  // Countdown timer — ticks every second while progress is showing
  useEffect(() => {
    if (!showProgress) {
      startTimeRef.current = null;
      setElapsed(0);
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = window.setInterval(() => {
      if (startTimeRef.current) {
        const newElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(newElapsed);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [showProgress]);

  async function handleStart() {
    setIsStarting(true);
    setErrorMessage(null);
    startTimeRef.current = Date.now();

    try {
      const response = await fetch(`/api/samples/${orderId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as StartSampleResponse;

      if (!response.ok || !payload.jobQueued) {
        throw new Error(payload.error ?? "We couldn't start your free page. Please try again.");
      }

      setIsAwaitingGeneration(true);
      trackEvent("sample_generation_started", { orderId, uploadCount });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't start your free page. Please try again.");
      startTimeRef.current = null;
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="upload-stack">
      {errorMessage ? (
        <div className="status-banner status-banner-warning" role="alert">
          <div className="status-banner-copy">
            <strong>We couldn't start the free page yet.</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {isReady ? (
        <div className="sample-ready-actions">
          <div className="status-banner status-banner-success status-banner-compact">
            <span className="pill pill-mint">Free page ready</span>
            <div className="status-banner-copy">
              <strong>Your sample is finished and ready to download.</strong>
              <p>If the result feels like your family, the full book builder is the next move.</p>
            </div>
          </div>
          <Link className="button button-primary" href={readyHref}>
            Download My Free Page
          </Link>
          <p className="muted">Love it? Turn your camera roll into the full book.</p>
          <Link className="button button-secondary" href="/create?source=sample-ready&acquisitionPath=sample_first">
            Build the Full Book
          </Link>
        </div>
      ) : null}

      {!isReady && !showProgress ? (
        <div className="hero-actions">
          <button className="button button-primary" disabled={uploadCount === 0} type="button" onClick={handleStart}>
            Create My Free Page
          </button>
        </div>
      ) : null}

      {showProgress && !isReady ? (
        <div aria-live="polite" className="processing-progress surface">
          <span className="pill pill-sky">Making your page now</span>
          <strong>Creating your free coloring page</strong>
          <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-timer">
            {elapsed > ESTIMATED_SECONDS
              ? "Taking a little longer than usual..."
              : formatTimeRemaining(remaining)}
          </p>
          <GalleryCarousel examples={galleryExamples} />
        </div>
      ) : null}
    </div>
  );
}
