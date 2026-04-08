import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { OfferCard } from "../../../components/offer-card";
import { SampleProcessingPanel } from "../../../components/sample-processing-panel";
import { TrackPageEvent } from "../../../components/track-page-event";
import { UploadDropzone } from "../../../components/upload-dropzone";
import { featuredOffers } from "../../../lib/offers";

const activeStatuses = new Set(["preprocessing", "generating", "qa_review"]);

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
          <span className="pill">Sample in progress</span>
          <h1>Start from the sample page first.</h1>
          <p className="lede">This step expects a real sample token so it can show upload state and processing status.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/sample">
              Go to Free Sample
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
          <span className="pill">Sample not found</span>
          <h1>We could not find that sample.</h1>
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
        <span className="pill">Sample in progress</span>
        <h1>{uploadedCount === 0 ? "Upload one photo to continue." : isProcessing ? "Your page is being created." : "Your photo is uploaded and ready."}</h1>
        <p className="lede">
          {uploadedCount === 0
            ? "This sample order already exists. Upload one favorite photo so the generation worker has a real source image to process."
            : isProcessing
              ? "The worker is now building the preview page. Refresh this screen in a few moments or come back from the email link when it is ready."
              : "The upload is attached to the sample order. Start generation when you are ready."}
        </p>

        <div className="status-banner">
          Status: <strong>{summary.order.status.replaceAll("_", " ")}</strong>
          {summary.order.childFirstName ? ` for ${summary.order.childFirstName}` : ""}
        </div>

        {uploadedCount === 0 ? (
          <UploadDropzone
            title="Upload one favorite photo"
            hint="The upload now lands on the real sample order. Once the file is uploaded, use the button below to start generation."
            entityType="sample"
            entityId={summary.order.id}
            buttonLabel="Choose Sample Photo"
          />
        ) : (
          <div className="surface upload-results">
            <span className="pill">Uploaded photo</span>
            <div className="upload-results-list">
              {summary.uploads.map((upload) => (
                <div className="upload-result" key={upload.id}>
                  <div>
                    <strong>{upload.fileName}</strong>
                    <p className="muted">{upload.objectPath}</p>
                  </div>
                  <span className={`upload-state upload-state-${upload.status}`}>{upload.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SampleProcessingPanel orderId={summary.order.id} readyHref={`/sample/${token}`} status={summary.order.status} uploadCount={uploadedCount} />

        <div className="offer-grid">
          {featuredOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} href="/create" />
          ))}
        </div>
      </section>
    </main>
  );
}
