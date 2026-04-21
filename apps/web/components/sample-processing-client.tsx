"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand-logo";

// ─── Types ────────────────────────────────────────────────────────────────────

type SampleStatus =
  | "draft"
  | "preprocessing"
  | "generating"
  | "qa_review"
  | "pdf_ready"
  | "failed"
  | "support_required"
  | string; // allow unknown statuses without narrowing errors

type StatusPollResponse = {
  orderId: string;
  status: SampleStatus;
  statusLabel: string;
  progressPercent: number;
  estimatedSecondsRemaining: number;
  previewUrl: string | null;
  error?: string;
};

type CreativeExample = {
  id: string;
  url: string;
  audience_tag: string | null;
};

type SampleProcessingClientProps = {
  token: string;
  initialStatus: SampleStatus;
  initialStatusLabel: string;
  initialProgressPercent: number;
  initialEstimatedSeconds: number;
  exampleSeedAudience?: "family" | "kids" | "pets";
  customerEmail?: string | null;
};

// ─── Status-driven copy ───────────────────────────────────────────────────────

const STATUS_HEADLINE: Record<string, string> = {
  draft: "Getting your photo ready\u2026",
  preprocessing: "Finding the best lines\u2026",
  generating: "Drawing your page\u2026",
  qa_review: "Final touches\u2026",
  pdf_ready: "Your page is ready!",
  failed: "Something went wrong.",
  support_required: "Under review.",
};

function getHeadline(status: SampleStatus): string {
  return STATUS_HEADLINE[status] ?? "Working on your page\u2026";
}

// ─── Audience tag display ─────────────────────────────────────────────────────

const AUDIENCE_DISPLAY: Record<string, string> = {
  family: "Family",
  kids: "Kids",
  pets: "Pets",
};

function formatAudienceTag(tag: string | null): string {
  if (!tag) return "Example";
  return AUDIENCE_DISPLAY[tag] ?? tag;
}

// ─── Examples carousel ────────────────────────────────────────────────────────

type ExamplesCarouselProps = {
  audience: "family" | "kids" | "pets" | undefined;
};

const EXAMPLE_ROTATION_MS = 5000;

function ExamplesCarousel({ audience }: ExamplesCarouselProps) {
  const [examples, setExamples] = useState<CreativeExample[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const audienceQuery = audience ? `&audience=${audience}` : "";
    fetch(`/api/public/creative-examples?limit=15${audienceQuery}`)
      .then((res) => res.json())
      .then((data: { examples: CreativeExample[] }) => {
        if (Array.isArray(data.examples) && data.examples.length > 0) {
          setExamples(data.examples);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Fail silently — carousel is non-critical
      });
  }, [audience]);

  const advance = useCallback(() => {
    if (examples.length <= 1) return;
    setFading(true);
    setTimeout(() => {
      setActiveIndex((i) => (i + 1) % examples.length);
      setFading(false);
    }, 300);
  }, [examples.length]);

  useEffect(() => {
    if (!loaded || examples.length <= 1) return;
    timerRef.current = setTimeout(advance, EXAMPLE_ROTATION_MS);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [advance, loaded, activeIndex, examples.length]);

  if (!loaded) return null;

  const example = examples[activeIndex];
  if (!example) return null;

  return (
    <div className="processing-examples">
      <p className="processing-examples-caption">
        While you wait, here&rsquo;s what other pages look like
      </p>
      <div
        className="processing-examples-stage"
        style={{ opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}
        aria-live="polite"
        aria-atomic="true"
      >
        <img
          src={example.url}
          alt={`Example coloring page for ${formatAudienceTag(example.audience_tag)}`}
          className="processing-examples-img"
          loading="lazy"
        />
        <span className="processing-examples-tag pill pill-sun">
          {formatAudienceTag(example.audience_tag)}
        </span>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

type ProgressBarProps = {
  percent: number;
  estimatedSeconds: number;
};

function ProgressBar({ percent, estimatedSeconds }: ProgressBarProps) {
  const timeLabel =
    estimatedSeconds <= 0
      ? "Almost done\u2026"
      : estimatedSeconds <= 15
        ? "About 15 seconds left"
        : estimatedSeconds <= 30
          ? "About 30 seconds left"
          : estimatedSeconds <= 60
            ? "About 1 minute left"
            : `About ${Math.ceil(estimatedSeconds / 60)} minutes left`;

  return (
    <div className="processing-progress-wrap">
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page generation progress"
      >
        <div
          className="progress-bar-fill"
          style={{
            width: `${percent}%`,
            transition: "width 1.2s ease",
          }}
        />
      </div>
      <div className="processing-progress-meta">
        <span className="processing-time-hint">Usually takes about 20&ndash;30 seconds</span>
        <span className="processing-time-remaining">{timeLabel}</span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProcessingSkeleton() {
  return (
    <div className="processing-skeleton" aria-hidden="true">
      <div className="skeleton skeleton-bar skeleton-bar-wide" />
      <div className="skeleton skeleton-bar skeleton-bar-medium" />
      <div className="skeleton skeleton-progress" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SampleProcessingClient({
  token,
  initialStatus,
  initialStatusLabel,
  initialProgressPercent,
  initialEstimatedSeconds,
  exampleSeedAudience,
  customerEmail,
}: SampleProcessingClientProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SampleStatus>(initialStatus);
  const [statusLabel, setStatusLabel] = useState(initialStatusLabel);
  const [progressPercent, setProgressPercent] = useState(initialProgressPercent);
  const [estimatedSeconds, setEstimatedSeconds] = useState(initialEstimatedSeconds);
  const [hasFailed, setHasFailed] = useState(initialStatus === "failed");

  // Show skeleton for first 200 ms to prevent layout flash
  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Poll every 3 s
  useEffect(() => {
    if (status === "pdf_ready" || status === "failed" || status === "support_required") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/samples/status/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusPollResponse;

        setStatus(data.status);
        setStatusLabel(data.statusLabel);
        setProgressPercent(data.progressPercent);
        setEstimatedSeconds(data.estimatedSecondsRemaining);

        if (data.status === "pdf_ready") {
          clearInterval(interval);
          router.push(`/sample/${token}`);
        }

        if (data.status === "failed" || data.status === "support_required") {
          clearInterval(interval);
          setHasFailed(true);
        }
      } catch {
        // Non-fatal — keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, status, router]);

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/sample">
          Home
        </Link>
      </header>

      <section className="sample-frame processing-frame">
        <span className="pill pill-sun">Free page in progress</span>

        {!hydrated ? (
          <ProcessingSkeleton />
        ) : hasFailed ? (
          <>
            <h1 className="processing-headline">Something went wrong.</h1>
            <p className="lede">
              We weren&rsquo;t able to generate your coloring page. Please try starting over and
              uploading your photo again.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/sample">
                Try Again
              </Link>
            </div>
          </>
        ) : (
          <div className="processing-layout">
            <div className="processing-copy">
              <h1 className="processing-headline">{getHeadline(status)}</h1>
              <p className="lede processing-sublabel" aria-live="polite">
                {statusLabel}
              </p>

              <ProgressBar percent={progressPercent} estimatedSeconds={estimatedSeconds} />

              {customerEmail ? (
                <p className="processing-email-note muted">
                  We&rsquo;ll also send a copy to{" "}
                  <strong>{customerEmail}</strong> when it&rsquo;s ready.
                </p>
              ) : null}

              <div className="processing-upsell">
                <Link
                  className="button button-secondary"
                  href="/create?source=processing-wait&acquisitionPath=sample_first"
                >
                  Build My Family Memory Book
                </Link>
              </div>
            </div>

            <ExamplesCarousel audience={exampleSeedAudience} />
          </div>
        )}
      </section>
    </main>
  );
}
