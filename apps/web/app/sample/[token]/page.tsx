import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { OfferCard } from "../../../components/offer-card";
import { TrackPageEvent } from "../../../components/track-page-event";
import { featuredOffers } from "../../../lib/offers";

type SampleReadyPageProps = {
  params: Promise<{ token: string }>;
};

export default async function SampleReadyPage({ params }: SampleReadyPageProps) {
  const { token } = await params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    notFound();
  }

  if (summary.order.status !== "pdf_ready" || !summary.assets.previewPath) {
    redirect(`/sample/processing?token=${encodeURIComponent(token)}&orderId=${encodeURIComponent(summary.order.id)}`);
  }

  const previewHref = `/api/orders/portal/${token}/preview`;

  return (
    <main>
      <TrackPageEvent
        eventName="sample_ready_viewed"
        eventProperties={{
          orderId: summary.order.id,
          selectedOffer: summary.order.selectedOfferCode,
          uploadCount: summary.uploads.length,
        }}
      />
      <section className="sample-frame">
        <span className="pill">Sample ready</span>
        <h1>Your sample page is ready.</h1>
        <p className="lede">
          This preview is tied to the real sample order and private asset path. From here the default path is still the 30-design book, with room to upgrade into 50 or 100 designs.
        </p>
        <div className="proof-card">
          <img alt="Generated coloring page preview" className="proof-card-visual" src={previewHref} />
          <h3>Preview Promise</h3>
          <p className="muted">The free sample proves the style before the user commits to a full book.</p>
        </div>
        <div className="hero-actions">
          <Link className="button button-primary" href="/create?offer=pdf-30">
            Continue With 30 Designs
          </Link>
          <Link className="button button-secondary" href="/create?offer=print-30">
            Make It Print + PDF
          </Link>
        </div>
        <div className="offer-grid">
          {featuredOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} href="/create" />
          ))}
        </div>
      </section>
    </main>
  );
}
