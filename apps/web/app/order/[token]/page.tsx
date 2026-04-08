import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderPortalSummary, type PortalSummary } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { TrackPageEvent } from "../../../components/track-page-event";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const statusCopy: Record<string, string> = {
  draft: "Your order draft is created. Finish checkout to start generation.",
  awaiting_payment: "Checkout is open. Once payment clears, the generation queue starts automatically.",
  paid: "Payment is confirmed and the job is entering the generation queue.",
  preprocessing: "We are normalizing uploads and preparing the page plan.",
  generating: "The coloring-page generation pass is running now.",
  qa_review: "Pages are in the cleanup and QA pass.",
  assembling_pdf: "The final PDF assets are being assembled.",
  pdf_ready: "Your PDF is ready. Download it below or come back from this portal anytime.",
  awaiting_print_submission: "The print file is ready and waiting to be submitted to Lulu.",
  submitted_to_lulu: "The print order was submitted to Lulu and is waiting to enter production.",
  in_production: "Lulu is printing and binding the book now.",
  shipped: "The printed book has shipped.",
  delivered: "The printed book shows as delivered.",
  failed: "This order needs manual attention. Reach out and we will fix it.",
  support_required: "This order is under manual review. Support is working on it.",
  refunded: "This order was refunded.",
};

function getMilestones(summary: PortalSummary) {
  const steps =
    summary.order.deliveryMode === "print"
      ? ["paid", "generating", "pdf_ready", "submitted_to_lulu", "in_production", "shipped"]
      : ["paid", "generating", "pdf_ready"];

  const statusIndex = (() => {
    switch (summary.order.status) {
      case "draft":
      case "awaiting_payment":
        return -1;
      case "paid":
        return 0;
      case "preprocessing":
      case "generating":
      case "qa_review":
        return 1;
      case "assembling_pdf":
      case "pdf_ready":
      case "awaiting_print_submission":
        return 2;
      case "submitted_to_lulu":
        return 3;
      case "in_production":
        return 4;
      case "shipped":
      case "delivered":
        return 5;
      default:
        return 0;
    }
  })();

  return steps.map((step, index) => ({
    key: step,
    label: step.replaceAll("_", " "),
    completed: index <= statusIndex,
    current: index === statusIndex,
  }));
}

export default async function OrderPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    notFound();
  }

  const offer = getOfferByCode(summary.order.selectedOfferCode);
  const milestones = getMilestones(summary);
  const downloadHref = summary.assets.downloadPdfPath || summary.assets.interiorPdfPath ? `/api/orders/portal/${token}/download` : null;

  return (
    <main>
      <TrackPageEvent
        eventName="order_portal_viewed"
        eventProperties={{
          orderId: summary.order.id,
          status: summary.order.status,
          deliveryMode: summary.order.deliveryMode,
          selectedOffer: summary.order.selectedOfferCode,
        }}
      />
      <section className="portal-card">
        <span className="pill">Customer portal</span>
        <h1>{offer.title}</h1>
        <p className="lede">{statusCopy[summary.order.status] ?? "We will keep this portal updated as the order moves forward."}</p>
        <div className="status-banner">
          <span className={`status-pill status-pill-${summary.order.status}`}>{summary.order.status.replaceAll("_", " ")}</span>
          <span>{summary.customer?.email ?? "guest checkout"}</span>
        </div>

        <div className="key-value-grid">
          <div>
            <span className="muted">Order total</span>
            <strong>{formatMoney(summary.order.totalCents)}</strong>
          </div>
          <div>
            <span className="muted">Design count</span>
            <strong>{summary.order.designCount}</strong>
          </div>
          <div>
            <span className="muted">Created</span>
            <strong>{formatDate(summary.order.createdAt)}</strong>
          </div>
          <div>
            <span className="muted">Child name</span>
            <strong>{summary.order.childFirstName ?? "Not provided"}</strong>
          </div>
        </div>

        <div className="portal-status-list">
          {milestones.map((step) => (
            <div className={`surface progress-step ${step.completed ? "is-complete" : ""} ${step.current ? "is-current" : ""}`} key={step.key}>
              <strong>{step.label}</strong>
              <p className="muted">{step.completed ? "Complete" : step.current ? "In progress" : "Pending"}</p>
            </div>
          ))}
        </div>

        <div className="hero-actions">
          {downloadHref ? (
            <Link className="button button-primary" href={downloadHref}>
              Download PDF
            </Link>
          ) : (
            <button className="button button-primary" disabled type="button">
              PDF not ready yet
            </button>
          )}
          <Link className="button button-secondary" href={`mailto:${process.env.SUPPORT_EMAIL ?? "support@littlecolorbook.com"}`}>
            Request Help
          </Link>
        </div>
      </section>

      <section className="section portal-grid-two">
        <div className="surface">
          <span className="pill">Uploads</span>
          {summary.uploads.length > 0 ? (
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
          ) : (
            <p className="muted">No uploads recorded yet.</p>
          )}
        </div>

        <div className="surface">
          <span className="pill">Delivery</span>
          <div className="timeline-list">
            <div className="timeline-item">
              <strong>{summary.order.deliveryMode === "print" ? "Print + PDF" : "PDF only"}</strong>
              <p className="muted">{offer.priceLabel}</p>
            </div>
            {summary.fulfillment ? (
              <div className="timeline-item">
                <strong>{summary.fulfillment.status.replaceAll("_", " ")}</strong>
                <p className="muted">{summary.fulfillment.trackingUrl ?? summary.fulfillment.shippingService ?? "Tracking pending"}</p>
              </div>
            ) : null}
            {summary.shippingAddress ? (
              <div className="timeline-item">
                <strong>{summary.shippingAddress.fullName ?? "Shipping address"}</strong>
                <p className="muted">
                  {summary.shippingAddress.line1}, {summary.shippingAddress.city}, {summary.shippingAddress.state} {summary.shippingAddress.postalCode}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-copy">
          <span className="pill">Timeline</span>
          <h2>Recent updates</h2>
          <p className="lede">Every significant order event is recorded here so parents can follow the pipeline from payment through delivery.</p>
        </div>
        <div className="timeline-list">
          {summary.events.length > 0 ? (
            summary.events.map((event) => (
              <div className="timeline-item" key={event.id}>
                <strong>{event.eventType}</strong>
                <p className="muted">{formatDate(event.createdAt)}</p>
              </div>
            ))
          ) : (
            <p className="muted">No events recorded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
