import Link from "next/link";
import { getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { BrandLogo } from "../../components/brand-logo";
import { CreateOrderForm } from "../../components/create-order-form";
import { TrackBuyerJourneyStage } from "../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../components/track-page-event";
import { getAcquisitionPayloadFromRecord } from "../../lib/acquisition";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { email, offer, source, sampleOrderId, childFirstName } = params;
  const acquisition = getAcquisitionPayloadFromRecord(params, "direct_buy", "builder-page");
  const sampleSummary = sampleOrderId ? await getOrderPortalSummaryByOrderId(sampleOrderId) : null;
  const initialEmail = email ?? sampleSummary?.customer?.email ?? undefined;
  const initialChildFirstName = childFirstName ?? sampleSummary?.order.childFirstName ?? undefined;

  return (
    <main>
      <TrackPageEvent eventName="builder_viewed" eventProperties={{ initialOffer: offer ?? "pdf-30", source: source ?? "default" }} />
      <TrackBuyerJourneyStage
        stage="builder_started"
        onceKey="builder-started"
        stageProperties={{
          initialOffer: offer ?? "pdf-30",
          surface: "builder_page",
          source: source ?? "default",
        }}
      />
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="build your book" />
        <Link className="topbar-link" href="/sample">
          Free sample
        </Link>
      </header>

      <section className="builder-layout">
        <CreateOrderForm
          acquisition={acquisition}
          initialChildFirstName={initialChildFirstName}
          initialEmail={initialEmail}
          initialOffer={offer}
        />
      </section>
    </main>
  );
}
