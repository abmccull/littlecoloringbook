import Link from "next/link";
import { getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { ShippingCheckoutForm } from "../../../components/shipping-checkout-form";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";

export default async function CreateShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; selectedOffer?: string }>;
}) {
  const params = await searchParams;
  const summary = params.orderId ? await getOrderPortalSummaryByOrderId(params.orderId) : null;
  const selectedOffer = params.selectedOffer ?? summary?.order.selectedOfferCode;

  return (
    <main>
      {params.orderId ? (
        <TrackBuyerJourneyStage
          stage="shipping_started"
          onceKey={`shipping-started:${params.orderId}`}
          stageProperties={{
            orderId: params.orderId,
            quantity: summary?.order.quantity ?? 1,
            selectedOffer: selectedOffer ?? null,
            surface: "shipping_page",
          }}
        />
      ) : null}
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="delivery details" />
        <Link className="topbar-link" href={`/create/uploads${params.orderId ? `?orderId=${encodeURIComponent(params.orderId)}${selectedOffer ? `&selectedOffer=${encodeURIComponent(selectedOffer)}` : ""}&deliveryMode=print` : ""}`}>
          Uploads
        </Link>
      </header>
      <ShippingCheckoutForm
        orderId={params.orderId}
        selectedOffer={selectedOffer}
        quantity={summary?.order.quantity}
        bundleSelection={summary?.order.bundleSelection}
        subtotalCents={summary?.order.subtotalCents}
      />
    </main>
  );
}
