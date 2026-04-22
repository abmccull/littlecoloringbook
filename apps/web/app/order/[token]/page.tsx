import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderPortalSummary, type PortalSummary } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { BrandLogo } from "../../../components/brand-logo";
import { TrackPageEvent } from "../../../components/track-page-event";
import { TrackedAnchor } from "../../../components/tracked-anchor";

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

function getUploadSupportCopy(status: string) {
  switch (status) {
    case "uploaded":
      return "Ready for your book";
    case "failed":
      return "Needs another look before we can use it";
    default:
      return "Still being prepared";
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
  const uploadedReadyCount = summary.uploads.filter((upload) => upload.status === "uploaded").length;
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
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="your order" />
        <Link className="topbar-link" href="/">
          Home
        </Link>
      </header>
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
            <TrackedAnchor
              className="button button-primary"
              href={downloadHref}
              eventName="order_pdf_download_clicked"
              eventProperties={{
                orderId: summary.order.id,
                deliveryMode: summary.order.deliveryMode,
                selectedOffer: summary.order.selectedOfferCode,
              }}
              journeyStage="pdf_accessed"
              journeyOnceKey={`pdf-accessed:${summary.order.id}`}
              journeyProperties={{
                orderId: summary.order.id,
                deliveryMode: summary.order.deliveryMode,
                selectedOffer: summary.order.selectedOfferCode,
                surface: "order_portal_download",
              }}
            >
              Download PDF
            </TrackedAnchor>
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

      <section className="section portal-media-stack">
        <div className="surface portal-media-surface">
          <div className="portal-media-header">
            <div className="stack-tight">
              <span className="pill pill-sky">Uploaded photos</span>
              <h2>Your photo gallery</h2>
              <p className="muted">
                These are the photos currently attached to this order, so you can recognize the book at a glance
                instead of scanning filenames.
              </p>
            </div>
            <div className="portal-media-stats" aria-label="Upload summary">
              <div className="portal-media-stat">
                <strong>{uploadedReadyCount}</strong>
                <span className="muted">{uploadedReadyCount === 1 ? "photo ready" : "photos ready"}</span>
              </div>
              <div className="portal-media-stat">
                <strong>{summary.uploads.length}</strong>
                <span className="muted">{summary.uploads.length === 1 ? "total upload" : "total uploads"}</span>
              </div>
            </div>
          </div>
          {summary.uploads.length > 0 ? (
            <div className="portal-upload-gallery">
              {summary.uploads.map((upload, index) => (
                <article className="portal-upload-card" key={upload.id}>
                  <div className="portal-upload-thumb">
                    {upload.status === "uploaded" ? (
                      <Image
                        alt={`Uploaded photo ${index + 1}`}
                        className="portal-upload-thumb-image"
                        fill
                        sizes="(max-width: 640px) 88vw, (max-width: 1024px) 42vw, 240px"
                        src={`/api/orders/portal/${token}/uploads/${upload.id}`}
                        unoptimized
                      />
                    ) : (
                      <div className="portal-upload-thumb-fallback">
                        <span>Photo {index + 1}</span>
                      </div>
                    )}
                  </div>
                  <div className="portal-upload-card-copy">
                    <div className="portal-upload-card-header">
                      <div className="portal-upload-meta">
                        <strong>{`Photo ${index + 1}`}</strong>
                        <p className="muted">{getUploadSupportCopy(upload.status)}</p>
                      </div>
                      <span className={`upload-state upload-state-${upload.status}`}>{prettifyUploadStatus(upload.status)}</span>
                    </div>
                    <p className="mini-note portal-upload-file" title={upload.fileName}>
                      {upload.fileName}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No uploads recorded yet.</p>
          )}
        </div>

        <div className="surface portal-delivery-surface">
          <div className="stack-tight">
            <span className="pill pill-coral">Delivery</span>
            <h2>How this order arrives</h2>
            <p className="muted">The key delivery details stay grouped here instead of getting lost beside a long upload list.</p>
          </div>
          <div className="portal-delivery-grid">
            <div className="portal-delivery-item">
              <span className="muted">Format</span>
              <strong>{summary.order.deliveryMode === "print" ? "Giftable Spiral Book + PDF" : "Print Tonight PDF"}</strong>
              <p className="mini-note">
                {summary.order.deliveryMode === "print"
                  ? `${summary.order.quantity} printed ${summary.order.quantity === 1 ? "copy" : "copies"} plus the digital file`
                  : offer.priceLabel}
              </p>
            </div>
            <div className="portal-delivery-item">
              <span className="muted">Current status</span>
              <strong>{summary.fulfillment ? prettify(summary.fulfillment.status) : prettify(summary.order.status)}</strong>
              <p className="mini-note">
                {summary.fulfillment?.trackingUrl ??
                  summary.fulfillment?.shippingService ??
                  (summary.order.deliveryMode === "print"
                    ? "Tracking appears here after the print partner hands it to the carrier."
                    : "Your PDF download button appears above as soon as it is ready.")}
              </p>
            </div>
            <div className="portal-delivery-item">
              <span className="muted">{summary.order.deliveryMode === "print" ? "Ships to" : "Book setup"}</span>
              <strong>
                {summary.shippingAddress?.fullName ??
                  (summary.order.deliveryMode === "print" ? "Shipping address on file" : "Digital delivery only")}
              </strong>
              <p className="mini-note">
                {summary.shippingAddress
                  ? `${summary.shippingAddress.line1}, ${summary.shippingAddress.city}, ${summary.shippingAddress.state} ${summary.shippingAddress.postalCode}`
                  : summary.order.deliveryMode === "print"
                    ? "Your delivery address will appear here once it is attached to the order."
                    : `${summary.order.designCount} personalized pages built from ${uploadedReadyCount} uploaded ${uploadedReadyCount === 1 ? "photo" : "photos"}.`}
              </p>
            </div>
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
          <TrackedAnchor
            className="button button-primary"
            href={upsellHref}
            eventName={summary.order.deliveryMode === "print" ? "extra_copy_upsell_clicked" : "spiral_upgrade_clicked"}
            eventProperties={{
              orderId: summary.order.id,
              deliveryMode: summary.order.deliveryMode,
              selectedOffer: summary.order.selectedOfferCode,
            }}
            journeyStage="post_purchase_upsell_clicked"
            journeyOnceKey={`post-purchase-upsell:${summary.order.id}`}
            journeyProperties={{
              orderId: summary.order.id,
              deliveryMode: summary.order.deliveryMode,
              selectedOffer: summary.order.selectedOfferCode,
              surface: "order_portal_upsell",
            }}
          >
            {summary.order.deliveryMode === "print" ? "Ask About Extra Copies" : "Add the Spiral Book"}
          </TrackedAnchor>
        </div>
      </section>

      {summary.order.orderType !== "sample" ? (
        <section className="section">
          <div className="section-copy">
            <span className="pill pill-coral">Your bonuses</span>
            <h2>Three extras that come with every book.</h2>
            <p className="lede">
              Print the Party Kit alongside the book. Keep the Photo Picker Guide near your camera roll. The
              Memory Vault is this page — your book stays downloadable here forever.
            </p>
          </div>
          <div className="detail-grid three-up">
            <article className="surface detail-card">
              <span className="pill pill-sun">$29 value</span>
              <strong>The Coloring Party Kit</strong>
              <p className="muted">
                A printable cover sheet, six coloring-session tips, and a kid-fillable &ldquo;About the Artist&rdquo;
                page — personalized with the cover name.
              </p>
              <TrackedAnchor
                className="button button-secondary"
                href={`/api/orders/portal/${token}/party-kit`}
                eventName="portal_bonus_download_clicked"
                eventProperties={{ orderId: summary.order.id, bonus: "party_kit" }}
              >
                Download Party Kit (PDF)
              </TrackedAnchor>
            </article>
            <article className="surface detail-card">
              <span className="pill pill-sun">$19 value</span>
              <strong>The Memory Vault</strong>
              <p className="muted">
                Bookmark this page. Your book stays downloadable here — no expiry, no account hunting. Come
                back any time to re-download or re-order.
              </p>
              <p className="mini-note">
                <strong>Permanent access.</strong> Your link doesn&rsquo;t expire.
              </p>
            </article>
            <article className="surface detail-card">
              <span className="pill pill-sun">$9 value</span>
              <strong>Best Photo Picker Guide</strong>
              <p className="muted">
                A one-page cheat sheet of which photo types make the cleanest coloring pages — keep it near
                your camera roll for the next book.
              </p>
              <TrackedAnchor
                className="button button-secondary"
                href={`/api/orders/portal/${token}/photo-picker-guide`}
                eventName="portal_bonus_download_clicked"
                eventProperties={{ orderId: summary.order.id, bonus: "photo_picker_guide" }}
              >
                Download Guide (PDF)
              </TrackedAnchor>
            </article>
          </div>
        </section>
      ) : null}

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
