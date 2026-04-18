import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import type { OrderStatus } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { SampleProcessingClient } from "../../../components/sample-processing-client";
import { SampleUploadFlow } from "../../../components/sample-upload-flow";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../../components/track-page-event";

const activeStatuses = new Set(["preprocessing", "generating", "qa_review"]);

// Label + progress mirrored from the status endpoint so the initial SSR render
// matches the first poll response without a visible flash.
const STATUS_LABEL: Record<string, string> = {
  draft: "Getting your photo ready",
  preprocessing: "Finding the best lines",
  generating: "Drawing your page",
  qa_review: "Final touches",
  pdf_ready: "Ready!",
  failed: "Something went wrong",
};

const STATUS_PROGRESS: Record<string, number> = {
  draft: 5,
  preprocessing: 25,
  generating: 55,
  qa_review: 85,
  pdf_ready: 100,
  failed: 0,
};

const TYPICAL_TOTAL_SECONDS = 75;

function estimateSecondsRemaining(status: string, createdAt: Date): number {
  if (status === "pdf_ready" || status === "failed") return 0;
  const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
  const progressFraction = (STATUS_PROGRESS[status] ?? 5) / 100;
  const estimatedElapsed = progressFraction * TYPICAL_TOTAL_SECONDS;
  return Math.max(0, Math.round(TYPICAL_TOTAL_SECONDS - Math.max(elapsedSeconds, estimatedElapsed)));
}

type SampleProcessingPageProps = {
  searchParams: Promise<{
    orderId?: string;
    token?: string;
  }>;
};

export default async function SampleProcessingPage({ searchParams }: SampleProcessingPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main>
        <header className="topbar topbar-flow">
          <BrandLogo href="/" subtitle="free sample page" />
          <Link className="topbar-link" href="/sample">
            Sample
          </Link>
        </header>
        <section className="sample-frame">
          <span className="pill pill-sun">Free sample</span>
          <h1>Start your free page first, then upload the photo here.</h1>
          <p className="lede">This screen only works after the first sample step creates your private link.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/sample">
              Start My Free Sample
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return (
      <main>
        <header className="topbar topbar-flow">
          <BrandLogo href="/" subtitle="free sample page" />
          <Link className="topbar-link" href="/sample">
            Start again
          </Link>
        </header>
        <section className="sample-frame">
          <span className="pill pill-coral">Sample not found</span>
          <h1>We couldn't find that sample link.</h1>
          <p className="lede">The safest next move is to start a new free sample so the photo and preview stay tied to the right inbox.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/sample">
              Start a New Sample
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (summary.order.status === "pdf_ready" && summary.assets.previewPath) {
    redirect(`/sample/${token}`);
  }

  const uploadedCount = summary.uploads.filter((upload) => upload.status === "uploaded").length;
  const isProcessing = activeStatuses.has(summary.order.status);

  // Show the animated waiting UI when the job is actively in-flight
  if (isProcessing) {
    const status = summary.order.status as OrderStatus;
    return (
      <>
        <TrackPageEvent
          eventName="sample_processing_viewed"
          eventProperties={{
            orderId: summary.order.id,
            status: summary.order.status,
            uploadCount: uploadedCount,
          }}
        />
        <TrackBuyerJourneyStage
          stage="sample_photo_uploaded"
          enabled={uploadedCount > 0}
          onceKey={`sample-photo-uploaded:${summary.order.id}`}
          stageProperties={{
            orderId: summary.order.id,
            uploadCount: uploadedCount,
            surface: "sample_processing_page",
          }}
        />
        <SampleProcessingClient
          token={token}
          initialStatus={status}
          initialStatusLabel={STATUS_LABEL[status] ?? "Processing"}
          initialProgressPercent={STATUS_PROGRESS[status] ?? 5}
          initialEstimatedSeconds={estimateSecondsRemaining(status, summary.order.createdAt)}
          exampleSeedAudience="family"
          customerEmail={summary.customer?.email ?? null}
        />
      </>
    );
  }

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/sample">
          Home
        </Link>
      </header>
      <TrackPageEvent
        eventName="sample_processing_viewed"
        eventProperties={{
          orderId: summary.order.id,
          status: summary.order.status,
          uploadCount: uploadedCount,
        }}
      />
      <TrackBuyerJourneyStage
        stage="sample_photo_uploaded"
        enabled={uploadedCount > 0}
        onceKey={`sample-photo-uploaded:${summary.order.id}`}
        stageProperties={{
          orderId: summary.order.id,
          uploadCount: uploadedCount,
          surface: "sample_processing_page",
        }}
      />
      <section className="sample-frame">
        <span className="pill pill-sun">{uploadedCount === 0 ? "Step 2 of 2" : "Photo uploaded"}</span>
        <h1>
          {uploadedCount === 0
            ? "Upload the photo you want us to turn into your free page."
            : "Your photo is in. Ready for the fun part?"}
        </h1>
        <p className="lede">
          {uploadedCount === 0
            ? "Pick one clear favorite. One child portrait, sibling moment, or pet photo is plenty."
            : "Your photo is attached. Hit the button to build your free page."}
        </p>

        <SampleUploadFlow
          orderId={summary.order.id}
          readyHref={`/sample/${token}`}
          status={summary.order.status}
          serverUploadCount={uploadedCount}
          initialUploads={summary.uploads.map((u) => ({ id: u.id, fileName: u.fileName, status: u.status as "uploaded" | "failed" }))}
        />
      </section>
    </main>
  );
}
