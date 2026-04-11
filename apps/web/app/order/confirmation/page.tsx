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
  const hasConfirmedOrder = Boolean(summary);

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
        <span className={`pill ${hasConfirmedOrder ? "pill-mint" : "pill-sun"}`}>{hasConfirmedOrder ? "You're in" : "Order lookup"}</span>
        <h1>{hasConfirmedOrder ? "You are officially in. We are making your book now." : "We could not confirm that order just yet."}</h1>
        <p className="lede">
          {hasConfirmedOrder
            ? "Your order is confirmed. Use the order page anytime to follow progress, download the PDF when it is ready, and check print delivery updates if you chose the spiral book."
            : "If checkout just finished, give it another moment and use the button below to head back to the builder or reopen the order page from the email link."}
        </p>
        <div className="portal-status-list">
          <div className="surface">
            <h3>Current status</h3>
            <p className="muted">{summary?.order.status.replaceAll("_", " ") ?? "Order not found yet"}</p>
          </div>
          <div className="surface">
            <h3>Your book</h3>
            <p className="muted">{offer.title}</p>
            <p className="muted">
              {summary?.order.deliveryMode === "print"
                ? `${summary.order.quantity} printed ${summary.order.quantity === 1 ? "copy" : "copies"}`
                : "Digital PDF"}
            </p>
            <p className="muted">{summary ? formatMoney(summary.order.totalCents) : offer.priceLabel}</p>
          </div>
          <div className="surface">
            <h3>What happens next</h3>
            <p className="muted">
              {hasConfirmedOrder
                ? "PDF orders move toward download first. Printed orders move from page prep into print and shipping after that."
                : "If payment succeeded, this page becomes your progress tracker. If not, head back to the builder and start fresh."}
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="button button-primary" href={portalHref}>
            {hasConfirmedOrder ? "Open My Order Page" : "Go Back to Builder"}
          </Link>
        </div>
      </section>
    </main>
  );
}
