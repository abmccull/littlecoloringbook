import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { SampleUploadFlow } from "../../../components/sample-upload-flow";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../../components/track-page-event";

const activeStatuses = new Set(["preprocessing", "generating", "qa_review"]);
const statusLabels: Record<string, string> = {
  draft: "Waiting for your photo",
  preprocessing: "Turning the photo into coloring lines",
  generating: "Building your page",
  qa_review: "Checking the final page",
  pdf_ready: "Ready to preview",
};

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
        <span className="pill pill-sun">{uploadedCount === 0 ? "Step 2 of 2" : isProcessing ? "Free page in progress" : "Photo uploaded"}</span>
        <h1>
          {uploadedCount === 0
            ? "Upload the photo you want us to turn into your free page."
            : isProcessing
              ? "Your free page is on the way."
              : "Your photo is in. Ready for the fun part?"}
        </h1>
        <p className="lede">
          {uploadedCount === 0
            ? "Pick one clear favorite. One child portrait, sibling moment, or pet photo is plenty."
            : isProcessing
              ? "We are turning that photo into bold coloring lines now."
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
