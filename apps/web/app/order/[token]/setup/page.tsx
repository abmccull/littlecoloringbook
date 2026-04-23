import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { getOfferByCode } from "@littlecolorbook/shared";
import { BrandLogo } from "../../../../components/brand-logo";
import { TrackPageEvent } from "../../../../components/track-page-event";
import { TrackPurchase } from "../../../../components/track-purchase";
import { OrderSetupForm } from "../../../../components/order-setup-form";

type SetupPageProps = {
  params: Promise<{ token: string }>;
};

export default async function OrderSetupPage({ params }: SetupPageProps) {
  const { token } = await params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    notFound();
  }

  // If the order is not paid, redirect to the order portal — they either
  // haven't paid yet or have already started generation.
  if (summary.order.status !== "paid") {
    // Use a redirect-like behavior by rendering a message with a link.
    // We avoid calling redirect() here because the order may be in progress.
    const portalHref = `/order/${token}`;

    return (
      <main>
        <header className="topbar topbar-flow">
          <BrandLogo href="/" subtitle="your order" />
          <Link className="topbar-link" href="/">
            Home
          </Link>
        </header>
        <section className="portal-card">
          <span className="pill pill-sky">Order in progress</span>
          <h1>Your book is already on its way.</h1>
          <p className="lede">
            We already have everything we need and your book is being built. Check the order page
            to follow progress and download your PDF when it is ready.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={portalHref}>
              Open My Order Page
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const offer = getOfferByCode(summary.order.selectedOfferCode);
  const deliveryMode = summary.order.deliveryMode === "print" ? "print" : "pdf";
  const existingUploads = summary.uploads.map((upload) => ({
    fileName: upload.fileName,
    objectPath: upload.objectPath,
    status: upload.status as "uploaded" | "failed",
  }));

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="setting up your book" />
        <Link className="topbar-link" href={`/order/${token}`}>
          My Order
        </Link>
      </header>
      <TrackPageEvent
        eventName="order_setup_viewed"
        eventProperties={{
          orderId: summary.order.id,
          deliveryMode: summary.order.deliveryMode,
          selectedOffer: summary.order.selectedOfferCode,
          uploadCount: summary.uploads.length,
        }}
      />
      <TrackPurchase
        orderId={summary.order.id}
        valueCents={summary.order.totalCents}
        currency={"USD"}
        offerCode={summary.order.selectedOfferCode}
      />
      <OrderSetupForm
        bundleSelection={summary.order.bundleSelection}
        orderId={summary.order.id}
        deliveryMode={deliveryMode}
        designCount={offer.designs}
        initialChildFirstName={summary.order.childFirstName ?? ""}
        initialCoverStyle={summary.order.coverStyle ?? "signature-linen"}
        initialDedicationText={summary.order.dedicationText ?? ""}
        offerTitle={offer.title}
        existingUploads={existingUploads}
        portalToken={token}
        portalHref={`/order/${token}`}
        quantity={summary.order.quantity}
        selectedOfferCode={summary.order.selectedOfferCode}
        shippingCents={summary.order.shippingCents}
        subtotalCents={summary.order.subtotalCents}
        totalCents={summary.order.totalCents}
      />
    </main>
  );
}
