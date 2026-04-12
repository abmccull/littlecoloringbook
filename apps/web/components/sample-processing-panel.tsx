"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
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

const ESTIMATED_SECONDS = 90;

const STATUS_PROGRESS: Record<string, number> = {
  preprocessing: 25,
  generating: 55,
  qa_review: 90,
  pdf_ready: 100,
};

const COLORING_FACTS = [
  "Coloring helps kids develop fine motor skills and hand-eye coordination.",
  "Children who color regularly show improved focus and concentration.",
  "Personalized coloring pages keep kids engaged 3x longer than generic ones.",
  "Coloring familiar faces helps children process and express emotions.",
  "The repetitive motion of coloring has a calming, meditative effect on kids.",
  "Kids remember coloring their own photos months after making the book.",
  "Coloring activates both hemispheres of the brain at the same time.",
  "Bold, simple outlines work best for ages 2 to 6. We optimize for that.",
  "Screen-free activities like coloring improve sleep quality in children.",
  "A 20-minute coloring session reduces anxiety in kids by up to 30%.",
  "Children develop color theory and spatial awareness through coloring.",
  "Personalized books become keepsakes that families revisit for years.",
  "Coloring pets and siblings helps kids strengthen emotional bonds.",
  "The best coloring pages have big shapes, clear subjects, and lots of white space.",
  "Kids as young as 18 months can start coloring with chunky crayons.",
  "Grandparents rank personalized coloring books as a top-3 gift to receive.",
  "Coloring builds the same hand muscles kids need for writing later.",
  "Family photos make the best coloring pages because kids recognize every detail.",
];

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
  const [factIndex, setFactIndex] = useState(0);
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
      setFactIndex(0);
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = window.setInterval(() => {
      if (startTimeRef.current) {
        const newElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(newElapsed);
        setFactIndex(Math.floor(newElapsed / 5) % COLORING_FACTS.length);
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
      {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}

      {isReady ? (
        <div className="sample-ready-actions">
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
          <strong>Creating your free coloring page</strong>
          <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-timer">
            {elapsed > ESTIMATED_SECONDS
              ? "Taking a little longer than usual..."
              : formatTimeRemaining(remaining)}
          </p>
          <div className="coloring-fact" key={factIndex}>
            <p className="coloring-fact-text">{COLORING_FACTS[factIndex]}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
