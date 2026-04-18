import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForCustomer } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { getCustomerSession } from "../../../../lib/auth";
import { RefundRequestButton } from "../../../../components/account/refund-request-button";

export const dynamic = "force-dynamic";

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getCustomerSession();

  if (!session) {
    return null;
  }

  const { orderId } = await params;
  const summary = await getOrderForCustomer({ customerId: session.customerId, orderId });

  if (!summary) {
    notFound();
  }

  const offer = getOfferByCode(summary.order.selectedOfferCode);
  const pdfReady = Boolean(summary.assets.downloadPdfPath || summary.assets.interiorPdfPath);
  const pdfEndpoint = `/api/account/orders/${summary.order.id}/download`;
  const trackingUrl = summary.fulfillment?.trackingUrl ?? null;

  return (
    <section className="account-section">
      <div className="portal-card">
        <span className={`status-pill status-pill-${summary.order.status}`}>
          {formatStatusLabel(summary.order.status)}
        </span>
        <h1>{offer.title}</h1>
        <p className="muted">
          Order <code>{summary.order.id}</code> · {summary.order.designCount} designs ·{" "}
          {formatMoney(summary.order.totalCents)}
        </p>

        <div className="account-cta-row">
          {pdfReady ? (
            <a className="button button-primary" href={pdfEndpoint}>
              Download PDF
            </a>
          ) : (
            <span className="muted">PDF is still being prepared — we'll email you when it's ready.</span>
          )}
          {trackingUrl ? (
            <a className="button button-secondary" href={trackingUrl} rel="noreferrer noopener" target="_blank">
              Track shipment
            </a>
          ) : null}
          <Link className="button button-secondary" href={`/account/orders/${summary.order.id}/tickets/new`}>
            Get help with this order
          </Link>
          <RefundRequestButton orderId={summary.order.id} />
        </div>
      </div>

      <div className="portal-card">
        <h2>Shipping</h2>
        {summary.shippingAddress ? (
          <address className="account-address">
            {summary.shippingAddress.fullName ?? session.email}
            <br />
            {summary.shippingAddress.line1}
            {summary.shippingAddress.line2 ? (
              <>
                <br />
                {summary.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {summary.shippingAddress.city}, {summary.shippingAddress.state} {summary.shippingAddress.postalCode}
            <br />
            {summary.shippingAddress.countryCode}
          </address>
        ) : (
          <p className="muted">No shipping address captured (PDF-only order).</p>
        )}
      </div>
    </section>
  );
}
