import Link from "next/link";
import { createPortalAccessForOrder, getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { TrackPageEvent } from "../../../components/track-page-event";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const summary = orderId ? await getOrderPortalSummaryByOrderId(orderId) : null;
  const portalAccess = summary ? await createPortalAccessForOrder(summary.order.id) : null;
  const offer = getOfferByCode(summary?.order.selectedOfferCode ?? "pdf-30");
  const portalHref = portalAccess?.portalHref ?? "/create";

  return (
    <main>
      <TrackPageEvent
        eventName="order_confirmation_viewed"
        eventProperties={{
          orderId: summary?.order.id ?? orderId ?? null,
          selectedOffer: offer.code,
          deliveryMode: summary?.order.deliveryMode ?? null,
        }}
      />
      <section className="portal-card">
        <span className="pill">Order confirmed</span>
        <h1>Payment received.</h1>
        <p className="lede">
          The order is now queued for generation and fulfillment. Use the portal to watch status changes, download the PDF, and follow any print shipment updates.
        </p>
        <div className="portal-status-list">
          <div className="surface">
            <h3>Current status</h3>
            <p className="muted">{summary?.order.status.replaceAll("_", " ") ?? "Awaiting reconciliation"}</p>
          </div>
          <div className="surface">
            <h3>Order</h3>
            <p className="muted">{offer.title}</p>
            <p className="muted">{summary ? formatMoney(summary.order.totalCents) : offer.priceLabel}</p>
          </div>
          <div className="surface">
            <h3>Customer promise</h3>
            <p className="muted">PDFs target minutes. Printed books target print submission within one business day before Lulu production begins.</p>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="button button-primary" href={portalHref}>
            Open Order Portal
          </Link>
        </div>
      </section>
    </main>
  );
}
