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

function prettify(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const statusCopy: Record<string, string> = {
  draft: "Your book is started. Finish checkout and we will take it from here.",
  awaiting_payment: "Checkout is still open. Once payment clears, we start building automatically.",
  paid: "You are officially in. We are getting your book started now.",
  preprocessing: "We are sorting your photos and laying out the pages.",
  generating: "We are turning your favorite photos into coloring pages now.",
  qa_review: "We are cleaning up the lines so the book feels ready to print and gift.",
  assembling_pdf: "We are wrapping up the PDF so it is ready to open and print.",
  pdf_ready: "Your PDF is ready below.",
  awaiting_print_submission: "Your PDF is ready and your spiral book is next in line for print.",
  submitted_to_lulu: "The spiral book has been sent to print.",
  in_production: "Your spiral book is being printed and spiral-bound now.",
  shipped: "Your printed book is on the way.",
  delivered: "Your printed book shows as delivered.",
  failed: "This order needs manual attention. Email us and we'll fix it.",
  support_required: "This order is under manual review. We'll keep you posted.",
  refunded: "This order was refunded.",
};

function prettifyUploadStatus(value: string) {
  switch (value) {
    case "uploaded":
      return "Ready";
    case "failed":
      return "Needs attention";
    default:
      return prettify(value);
  }
}

function getMilestones(summary: PortalSummary) {
  const steps =
    summary.order.deliveryMode === "print"
      ? [
          { key: "paid", label: "Order confirmed" },
          { key: "generating", label: "Pages in progress" },
          { key: "pdf_ready", label: "PDF ready" },
          { key: "submitted_to_lulu", label: "Sent to print" },
          { key: "in_production", label: "Printing" },
          { key: "shipped", label: "Shipped" },
        ]
      : [
          { key: "paid", label: "Order confirmed" },
          { key: "generating", label: "Pages in progress" },
          { key: "pdf_ready", label: "PDF ready" },
        ];

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
    ...step,
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
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@littlecolorbook.com";
  const supportHref = `mailto:${supportEmail}`;
  const upsellSubject =
    summary.order.deliveryMode === "print"
      ? `Extra spiral copy request for order ${summary.order.id}`
      : `Add spiral book for order ${summary.order.id}`;
  const upsellBody =
    summary.order.deliveryMode === "print"
      ? `Hi, I would like to order an extra printed copy for order ${summary.order.id}.`
      : `Hi, I would like to add the printed spiral book for order ${summary.order.id}.`;
  const upsellHref = `mailto:${supportEmail}?subject=${encodeURIComponent(upsellSubject)}&body=${encodeURIComponent(upsellBody)}`;

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
        <span className="pill pill-sun">Your order</span>
        <h1>{offer.title}</h1>
        <p className="lede">{statusCopy[summary.order.status] ?? "We will keep this page updated as your order moves forward."}</p>
        <div className="status-banner status-banner-progress">
          <span className={`status-pill status-pill-${summary.order.status}`}>{prettify(summary.order.status)}</span>
          <span>{summary.customer?.email ?? "Guest checkout"}</span>
        </div>

        <div className="key-value-grid">
          <div>
            <span className="muted">Order total</span>
            <strong>{formatMoney(summary.order.totalCents)}</strong>
          </div>
          <div>
            <span className="muted">Pages</span>
            <strong>{summary.order.designCount}</strong>
          </div>
          <div>
            <span className="muted">Created</span>
            <strong>{formatDate(summary.order.createdAt)}</strong>
          </div>
          <div>
            <span className="muted">Printed copies</span>
            <strong>{summary.order.deliveryMode === "print" ? summary.order.quantity : "Digital only"}</strong>
          </div>
          <div>
            <span className="muted">Cover name</span>
            <strong>{summary.order.childFirstName ?? "Not provided"}</strong>
          </div>
        </div>

        <div className="portal-status-list">
          {milestones.map((step) => (
            <div className={`surface progress-step ${step.completed ? "is-complete" : ""} ${step.current ? "is-current" : ""}`} key={step.key}>
              <strong>{step.label}</strong>
              <p className="muted">{step.completed ? "Done" : step.current ? "In progress" : "Coming next"}</p>
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
          <a className="button button-secondary" href={supportHref}>
            Email Support
          </a>
        </div>
      </section>

      <section className="section portal-grid-two">
        <div className="surface">
          <span className="pill pill-sky">Uploaded photos</span>
          {summary.uploads.length > 0 ? (
            <div className="upload-results-list">
              {summary.uploads.map((upload) => (
                <div className="upload-result" key={upload.id}>
                  <div>
                    <strong>{upload.fileName}</strong>
                    <p className="muted">Added to your book</p>
                  </div>
                  <span className={`upload-state upload-state-${upload.status}`}>{prettifyUploadStatus(upload.status)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No uploads recorded yet.</p>
          )}
        </div>

        <div className="surface">
          <span className="pill pill-coral">Delivery</span>
          <div className="timeline-list">
            <div className="timeline-item">
              <strong>{summary.order.deliveryMode === "print" ? "Giftable Spiral Book + PDF" : "Print Tonight PDF"}</strong>
              <p className="muted">
                {summary.order.deliveryMode === "print"
                  ? `${summary.order.quantity} printed ${summary.order.quantity === 1 ? "copy" : "copies"}`
                  : offer.priceLabel}
              </p>
            </div>
            {summary.fulfillment ? (
              <div className="timeline-item">
                <strong>{prettify(summary.fulfillment.status)}</strong>
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
        <div className="cta-band">
          <div className="stack-tight">
            <span className="pill pill-mint">{summary.order.deliveryMode === "print" ? "Need another copy?" : "Want the spiral book too?"}</span>
            <h3>{summary.order.deliveryMode === "print" ? "Want extra copies for siblings or grandparents?" : "Love the PDF and want the spiral book too?"}</h3>
            <p className="muted">
              {summary.order.deliveryMode === "print"
                ? "Use the button below and we can help you add more printed copies without rebuilding the whole book."
                : "Use the button below if you want to turn this order into the giftable spiral version too."}
            </p>
          </div>
          <a className="button button-primary" href={upsellHref}>
            {summary.order.deliveryMode === "print" ? "Ask About Extra Copies" : "Add the Spiral Book"}
          </a>
        </div>
      </section>

      <section className="section">
        <div className="section-copy">
          <span className="pill pill-sun">Recent updates</span>
          <h2>Your order timeline</h2>
          <p className="lede">Every meaningful update shows up here as your book moves from payment to delivery.</p>
        </div>
        <div className="timeline-list">
          {summary.events.length > 0 ? (
            summary.events.map((event) => (
              <div className="timeline-item" key={event.id}>
                <strong>{prettify(event.eventType)}</strong>
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
