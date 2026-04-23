import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderPortalSummary, type PortalSummary } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { objectExists } from "@littlecolorbook/shared/storage";
import { BrandLogo } from "../../../components/brand-logo";
import { PortalPageIssuesPanel } from "../../../components/portal-page-issues-panel";
import { TrackPageEvent } from "../../../components/track-page-event";
import { TrackedAnchor } from "../../../components/tracked-anchor";

type PortalEvent = PortalSummary["events"][number];
type PortalUpload = PortalSummary["uploads"][number];
type PortalTimelineItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: Date | string;
};

const downloadReadyStatuses = new Set([
  "pdf_ready",
  "awaiting_print_submission",
  "submitted_to_lulu",
  "in_production",
  "shipped",
  "delivered",
]);

const warningStatuses = new Set(["failed", "support_required", "refunded"]);
const successStatuses = new Set([
  "pdf_ready",
  "awaiting_print_submission",
  "submitted_to_lulu",
  "in_production",
  "shipped",
  "delivered",
]);

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
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
  support_required: "We finished the good pages and flagged a few that need your choice below.",
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

function getUploadSupportCopy(status: PortalUpload["status"]) {
  switch (status) {
    case "uploaded":
      return "Ready for your book";
    case "failed":
      return "Needs another look before we can use it";
    default:
      return "Still being prepared";
  }
}

function hasEvent(summary: PortalSummary, ...eventTypes: string[]) {
  return summary.events.some((event) => eventTypes.includes(event.eventType));
}

function hasGenerationStarted(summary: PortalSummary) {
  return (
    hasEvent(
      summary,
      "order.generation_started",
      "generation.full_book_requested",
      "generation.full_book_started",
      "generation.full_book_running",
      "generation.full_book_materialized",
      "generation.full_book_completed",
      "generation.full_book_failed",
    ) ||
    [
      "preprocessing",
      "generating",
      "qa_review",
      "assembling_pdf",
      "pdf_ready",
      "awaiting_print_submission",
      "submitted_to_lulu",
      "in_production",
      "shipped",
      "delivered",
      "failed",
      "support_required",
    ].includes(summary.order.status)
  );
}

function hasPayment(summary: PortalSummary) {
  return (
    hasEvent(summary, "checkout.session_completed") ||
    !["draft", "awaiting_payment"].includes(summary.order.status)
  );
}

function hasPdfReady(summary: PortalSummary) {
  return (
    hasEvent(summary, "pdf.ready", "print.assets_ready") ||
    [
      "pdf_ready",
      "awaiting_print_submission",
      "submitted_to_lulu",
      "in_production",
      "shipped",
      "delivered",
    ].includes(summary.order.status)
  );
}

function getMilestones(summary: PortalSummary) {
  if (summary.order.status === "failed" || summary.order.status === "support_required") {
    return [
      { key: "paid", label: "Order confirmed", completed: hasPayment(summary), current: false },
      { key: "generating", label: "Pages in progress", completed: hasGenerationStarted(summary), current: false },
      { key: "manual_review", label: "Manual review", completed: false, current: true },
    ];
  }

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

function getStatusBannerClassName(status: PortalSummary["order"]["status"]) {
  if (warningStatuses.has(status)) {
    return "status-banner status-banner-warning";
  }

  if (successStatuses.has(status)) {
    return "status-banner status-banner-success";
  }

  return "status-banner status-banner-progress";
}

function extractFailedPageNumber(event: PortalEvent) {
  const message = typeof event.details?.message === "string" ? event.details.message : "";
  const match = message.match(/page\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function buildUploadTimelineItem(summary: PortalSummary) {
  const latestUploadEvent = summary.events.find((event) => event.eventType === "upload.completed");

  if (!latestUploadEvent || summary.uploads.length === 0) {
    return null;
  }

  const uploadedCount = summary.uploads.filter((upload) => upload.status === "uploaded").length;
  const targetCount = Math.max(summary.order.designCount, uploadedCount);
  const remainingCount = Math.max(targetCount - uploadedCount, 0);

  return {
    id: `uploads-${latestUploadEvent.id}`,
    kind: "uploads",
    title: `You uploaded ${uploadedCount} of ${targetCount} photos`,
    detail:
      remainingCount === 0
        ? "We have everything we need to build your book."
        : `${remainingCount} more ${remainingCount === 1 ? "photo is" : "photos are"} still needed.`,
    createdAt: latestUploadEvent.createdAt,
  } satisfies PortalTimelineItem;
}

function mapPortalEvent(summary: PortalSummary, event: PortalEvent): PortalTimelineItem | null {
  switch (event.eventType) {
    case "checkout.session_completed":
      return {
        id: event.id,
        kind: "payment",
        title: "Payment received",
        detail: "Your order is officially in progress.",
        createdAt: event.createdAt,
      };
    case "order.customization_updated":
      return {
        id: event.id,
        kind: "details",
        title: "Book details saved",
        detail: "We saved your cover name and book settings.",
        createdAt: event.createdAt,
      };
    case "order.generation_started":
    case "generation.full_book_requested":
    case "generation.full_book_started":
    case "generation.full_book_running":
      return {
        id: event.id,
        kind: "generation",
        title: "We started drawing your pages",
        detail: "Your photos are in the coloring-page pipeline now.",
        createdAt: event.createdAt,
      };
    case "generation.full_book_materialized":
    case "generation.full_book_completed":
      return {
        id: event.id,
        kind: "generation_complete",
        title: "Your pages finished rendering",
        detail: "We are moving your book into final assembly.",
        createdAt: event.createdAt,
      };
    case "generation.customer_review_required": {
      const failedPageCount =
        typeof event.details?.failedPageCount === "number" ? Math.max(1, Math.trunc(event.details.failedPageCount)) : 1;
      return {
        id: event.id,
        kind: "review_needed",
        title: failedPageCount === 1 ? "We need your choice on 1 page" : `We need your choice on ${failedPageCount} pages`,
        detail: "The rest of the book kept moving. Review the flagged pages below so we can finish the PDF.",
        createdAt: event.createdAt,
      };
    }
    case "generation.page_source_updated":
      return {
        id: event.id,
        kind: "replacement_received",
        title: "Replacement photo received",
        detail: "We attached your new photo to that page and queued a fresh redraw.",
        createdAt: event.createdAt,
      };
    case "generation.page_rerender_started":
      return {
        id: event.id,
        kind: "rerender_started",
        title: "We are redrawing a flagged page",
        detail: "You do not need to restart the whole order - we are only redrawing the page you changed.",
        createdAt: event.createdAt,
      };
    case "generation.full_book_page_failed": {
      const failedPageNumber = extractFailedPageNumber(event) ?? (typeof event.details?.pageNumber === "number" ? event.details.pageNumber : null);
      return {
        id: event.id,
        kind: "quality_issue",
        title: "We caught a quality issue before delivery",
        detail: failedPageNumber
          ? `Page ${failedPageNumber} did not pass our line-art quality check, so we held it for your review.`
          : "A page did not pass our line-art quality check, so we held it for your review.",
        createdAt: event.createdAt,
      };
    }
    case "generation.full_book_page_approved_by_customer":
      return {
        id: event.id,
        kind: "page_approved",
        title: "You approved a flagged page",
        detail: "We kept that page as-is and checked whether the full PDF could be finalized.",
        createdAt: event.createdAt,
      };
    case "generation.full_book_failed": {
      const failedPageNumber = extractFailedPageNumber(event);
      return {
        id: event.id,
        kind: "quality_issue",
        title: "We caught a quality issue before delivery",
        detail: failedPageNumber
          ? `Page ${failedPageNumber} did not pass our line-art quality check, so we stopped before sending a bad PDF.`
          : "A page did not pass our line-art quality check, so we stopped before sending a bad PDF.",
        createdAt: event.createdAt,
      };
    }
    case "pdf.ready":
    case "print.assets_ready":
      return {
        id: event.id,
        kind: "pdf_ready",
        title:
          summary.order.deliveryMode === "print"
            ? "Your PDF is ready and print prep is next"
            : "Your PDF is ready to download",
        detail:
          summary.order.deliveryMode === "print"
            ? "We finished the digital file and are lining up the spiral book for print."
            : "Your file passed final assembly and is ready below.",
        createdAt: event.createdAt,
      };
    case "lulu.job_submitted":
      return {
        id: event.id,
        kind: "print_submitted",
        title: "Your spiral book was sent to print",
        detail: "Printing is underway and tracking will appear here when it is available.",
        createdAt: event.createdAt,
      };
    case "lulu.status_synced": {
      const trackingUrl = typeof event.details?.trackingUrl === "string" ? event.details.trackingUrl : null;
      const providerStatus = typeof event.details?.providerStatus === "string" ? event.details.providerStatus : null;
      return {
        id: event.id,
        kind: trackingUrl ? "tracking" : "print_status",
        title: trackingUrl ? "Tracking is live" : "Print status updated",
        detail: trackingUrl
          ? "Your printed book has a carrier update now."
          : providerStatus
            ? `Latest print status: ${prettify(providerStatus)}.`
            : "We synced the latest update from the print provider.",
        createdAt: event.createdAt,
      };
    }
    default:
      return null;
  }
}

function getCustomerTimeline(summary: PortalSummary) {
  const items: PortalTimelineItem[] = [];
  const uploadItem = buildUploadTimelineItem(summary);

  if (uploadItem) {
    items.push(uploadItem);
  }

  for (const event of summary.events) {
    if (event.eventType === "upload.completed") {
      continue;
    }

    const mapped = mapPortalEvent(summary, event);

    if (mapped) {
      items.push(mapped);
    }
  }

  if (items.length === 0) {
    items.push({
      id: `status-${summary.order.id}`,
      kind: "status",
      title: prettify(summary.order.status),
      detail: statusCopy[summary.order.status] ?? "We will keep this page updated as your order moves forward.",
      createdAt: summary.order.createdAt,
    });
  }

  const seenKinds = new Set<string>();

  return items
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .filter((item) => {
      if (seenKinds.has(item.kind)) {
        return false;
      }

      seenKinds.add(item.kind);
      return true;
    })
    .slice(0, 12);
}

async function getPortalDownloadHref(summary: PortalSummary, token: string) {
  if (!downloadReadyStatuses.has(summary.order.status) || !getIntegrationStatus().gcsConfigured) {
    return null;
  }

  const candidates = [summary.assets.downloadPdfPath, summary.assets.interiorPdfPath].filter(
    (value): value is string => Boolean(value),
  );

  for (const objectPath of candidates) {
    if (await objectExists({ bucket: "exports", objectPath })) {
      return `/api/orders/portal/${token}/download`;
    }
  }

  return null;
}

export default async function OrderPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    notFound();
  }

  const offer = getOfferByCode(summary.order.selectedOfferCode);
  const milestones = getMilestones(summary);
  const timelineItems = getCustomerTimeline(summary);
  const downloadHref = await getPortalDownloadHref(summary, token);
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
  const activeStatusCopy =
    summary.pageIssues.length > 0 && (summary.order.status === "failed" || summary.order.status === "support_required")
      ? "We finished the good pages and flagged a few that need your choice below."
      : statusCopy[summary.order.status] ?? "We will keep this page updated as your order moves forward.";
  const displayStatusLabel =
    summary.pageIssues.length > 0 && (summary.order.status === "failed" || summary.order.status === "support_required")
      ? "Needs your choice"
      : prettify(summary.order.status);

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
        <p className="lede">{activeStatusCopy}</p>
        <div className={getStatusBannerClassName(summary.order.status)}>
          <span className={`status-pill status-pill-${summary.order.status}`}>{displayStatusLabel}</span>
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
            <div
              className={`surface progress-step ${step.completed ? "is-complete" : ""} ${step.current ? "is-current" : ""}`}
              key={step.key}
            >
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
          ) : null}
          <a className="button button-secondary" href={supportHref}>
            Email Support
          </a>
        </div>
      </section>

      {summary.pageIssues.length > 0 ? (
        <PortalPageIssuesPanel
          orderId={summary.order.id}
          pageIssues={summary.pageIssues.map((issue) => ({
            id: issue.id,
            pageNumber: issue.pageNumber,
            uploadId: issue.uploadId,
            uploadFileName: issue.uploadFileName,
            qaFlags: issue.qaFlags,
            canApprove: issue.canApprove,
            previewObjectPath: issue.previewObjectPath,
          }))}
          portalToken={token}
        />
      ) : null}

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
              {summary.uploads.map((upload: PortalUpload, index) => (
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
            <h2>Three extras that make the book even easier to use and keep.</h2>
            <p className="lede">
              Use the Quiet-Time Pack tonight. Fill in the Keepsake Companion while this age is still fresh. Keep the
              Camera Roll Playbook near your camera roll for the next book.
            </p>
          </div>
          <div className="detail-grid three-up">
            <article className="surface detail-card">
              <span className="pill pill-sun">$29 value</span>
              <strong>Quiet-Time Pack</strong>
              <p className="muted">
                A screen-free family pack for tonight: quick resets, rainy-afternoon ideas, restaurant rescue prompts,
                sibling-sharing games, and story prompts that make one book last longer.
              </p>
              <TrackedAnchor
                className="button button-secondary"
                download
                href={`/api/orders/portal/${token}/party-kit`}
                eventName="portal_bonus_download_clicked"
                eventProperties={{ orderId: summary.order.id, bonus: "quiet_time_pack" }}
              >
                Download Quiet-Time Pack
              </TrackedAnchor>
            </article>
            <article className="surface detail-card">
              <span className="pill pill-sun">$19 value</span>
              <strong>Keepsake Companion</strong>
              <p className="muted">
                A printable companion for the details you do not want to lose: favorite pages, family notes, what this
                age feels like, and the little stories behind the book.
              </p>
              <TrackedAnchor
                className="button button-secondary"
                download
                href={`/api/orders/portal/${token}/keepsake-companion`}
                eventName="portal_bonus_download_clicked"
                eventProperties={{ orderId: summary.order.id, bonus: "keepsake_companion" }}
              >
                Download Keepsake Companion
              </TrackedAnchor>
            </article>
            <article className="surface detail-card">
              <span className="pill pill-sun">$9 value</span>
              <strong>Camera Roll Playbook</strong>
              <p className="muted">
                A smarter way to pull the next book from your camera roll: what works best, what to skip, and fun
                comic-book or movie-style theme ideas.
              </p>
              <TrackedAnchor
                className="button button-secondary"
                download
                href={`/api/orders/portal/${token}/photo-picker-guide`}
                eventName="portal_bonus_download_clicked"
                eventProperties={{ orderId: summary.order.id, bonus: "camera_roll_playbook" }}
              >
                Download Camera Roll Playbook
              </TrackedAnchor>
            </article>
          </div>
          <p className="mini-note" style={{ marginTop: "1rem" }}>
            <strong>Memory Vault included.</strong> This order page is still your permanent place to re-download the
            book whenever you want it again.
          </p>
        </section>
      ) : null}

      <section className="section">
        <div className="section-copy">
          <span className="pill pill-sun">Recent updates</span>
          <h2>Your order timeline</h2>
          <p className="lede">Every meaningful update shows up here as your book moves from payment to delivery.</p>
        </div>
        <div className="timeline-list">
          {timelineItems.length > 0 ? (
            timelineItems.map((item) => (
              <div className="timeline-item" key={item.id}>
                <div className="timeline-item-copy">
                  <strong>{item.title}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
                <p className="mini-note">{formatDate(item.createdAt)}</p>
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
