import Link from "next/link";
import { createPortalAccessForOrder, getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { ShippingCheckoutForm } from "../../../components/shipping-checkout-form";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";

export default async function CreateShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; returnTo?: string; selectedOffer?: string }>;
}) {
  const params = await searchParams;
  const summary = params.orderId ? await getOrderPortalSummaryByOrderId(params.orderId) : null;
  const selectedOffer = params.selectedOffer ?? summary?.order.selectedOfferCode;
  const isPaidUpgrade = summary?.order.status === "paid";
  const portalAccess =
    params.orderId && isPaidUpgrade && !params.returnTo ? await createPortalAccessForOrder(params.orderId) : null;
  const returnHref =
    params.returnTo ??
    (portalAccess?.portalHref ? `${portalAccess.portalHref}/setup` : `/create?offer=${encodeURIComponent(selectedOffer ?? "print-30")}`);
  const returnLabel = isPaidUpgrade ? "Back to upload stage" : "Back to builder";

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
            surface: isPaidUpgrade ? "shipping_upgrade_page" : "shipping_page",
          }}
        />
      ) : null}
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="delivery details" />
        <Link className="topbar-link" href={returnHref}>
          {returnLabel}
        </Link>
      </header>
      <ShippingCheckoutForm
        currentOrderTotalCents={isPaidUpgrade ? summary?.order.totalCents : undefined}
        initialAddress={summary?.shippingAddress ?? null}
        isPaidUpgrade={isPaidUpgrade}
        orderId={params.orderId}
        returnHref={returnHref}
        returnLabel={returnLabel}
        selectedOffer={selectedOffer}
        quantity={summary?.order.quantity}
        bundleSelection={summary?.order.bundleSelection}
      />
    </main>
  );
}
