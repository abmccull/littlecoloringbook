import Link from "next/link";
import { getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { ShippingCheckoutForm } from "../../../components/shipping-checkout-form";

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
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>delivery details</span>
        </div>
        <Link className="button button-secondary" href={`/create/uploads${params.orderId ? `?orderId=${encodeURIComponent(params.orderId)}${selectedOffer ? `&selectedOffer=${encodeURIComponent(selectedOffer)}` : ""}&deliveryMode=print` : ""}`}>
          Back to Uploads
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
