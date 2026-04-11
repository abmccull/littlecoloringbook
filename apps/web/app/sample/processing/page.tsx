import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { BookMockupBlock } from "../../../components/proof-modules";
import { SampleProcessingPanel } from "../../../components/sample-processing-panel";
import { TrackPageEvent } from "../../../components/track-page-event";
import { UploadDropzone } from "../../../components/upload-dropzone";
import { proofAssets } from "../../../lib/consumer-content";

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
      <TrackPageEvent
        eventName="sample_processing_viewed"
        eventProperties={{
          orderId: summary.order.id,
          status: summary.order.status,
          uploadCount: uploadedCount,
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
            ? "Pick one clear favorite. One child portrait, sibling moment, or pet photo is plenty for the free sample."
            : isProcessing
              ? "This is your quick waiting room. We are turning that photo into bold coloring lines now."
              : "Your photo is attached. When you hit the button, we will build the sample page from it."}
        </p>

        <div className="status-banner status-banner-progress">
          <strong>{statusLabels[summary.order.status] ?? summary.order.status.replaceAll("_", " ")}</strong>
          <span>
            {uploadedCount === 0
              ? "Upload one photo to keep going."
              : isProcessing
                ? "We will keep checking this screen automatically and move you forward when the page is ready."
                : "Your photo is attached. Start the free page whenever you are ready."}
          </span>
        </div>

        {uploadedCount === 0 ? (
          <UploadDropzone
            title="Upload one favorite photo"
            hint="Close-up kid portraits, one clear family moment, and pet photos work best."
            entityType="sample"
            entityId={summary.order.id}
            buttonLabel="Choose My Photo"
          />
        ) : (
          <div className="surface upload-results">
            <span className="pill pill-mint">Photo ready</span>
            <div className="upload-results-list">
              {summary.uploads.map((upload) => (
                <div className="upload-result" key={upload.id}>
                  <div>
                    <strong>{upload.fileName}</strong>
                    <p className="muted">Attached to your free sample</p>
                  </div>
                  <span className={`upload-state upload-state-${upload.status}`}>{upload.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SampleProcessingPanel orderId={summary.order.id} readyHref={`/sample/${token}`} status={summary.order.status} uploadCount={uploadedCount} />

        <BookMockupBlock
          coverSrc={proofAssets.kidPhoto}
          pageSrc={proofAssets.kidPage}
          title="If the free page feels like a yes, the full book is next."
          copy="Use this sample as your proof. If your child loves it, turn the rest of your favorite photos into the 30, 50, or 100-page version right after this."
        />
      </section>
    </main>
  );
}
