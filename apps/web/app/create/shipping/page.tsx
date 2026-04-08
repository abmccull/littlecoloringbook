import { ShippingCheckoutForm } from "../../../components/shipping-checkout-form";

export default async function CreateShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; selectedOffer?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <ShippingCheckoutForm orderId={params.orderId} selectedOffer={params.selectedOffer} />
    </main>
  );
}
