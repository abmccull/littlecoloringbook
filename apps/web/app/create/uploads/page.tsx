import { UploadsStep } from "../../../components/uploads-step";

export default async function CreateUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ deliveryMode?: string; orderId?: string; selectedOffer?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <UploadsStep deliveryMode={params.deliveryMode} orderId={params.orderId} selectedOffer={params.selectedOffer} />
    </main>
  );
}
