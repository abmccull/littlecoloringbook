import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { BookMockupBlock } from "../../../components/proof-modules";
import { SampleOfferCheckoutButton } from "../../../components/sample-offer-checkout-button";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../../components/track-page-event";
import { consumerOffers, getConsumerOffer, guarantees, proofAssets } from "../../../lib/consumer-content";

type SampleReadyPageProps = {
  params: Promise<{ token: string }>;
};

const alternativeOffers = consumerOffers.filter((offer) => offer.code === "pdf-30" || offer.code === "pdf-100");

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
  const primaryOffer = getConsumerOffer("pdf-50");

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/sample">
          Home
        </Link>
      </header>
      <TrackPageEvent
        eventName="sample_ready_viewed"
        eventProperties={{
          orderId: summary.order.id,
          selectedOffer: summary.order.selectedOfferCode,
          uploadCount: summary.uploads.length,
        }}
      />
      <TrackBuyerJourneyStage
        stage="sample_ready_viewed"
        onceKey={`sample-ready:${summary.order.id}`}
        stageProperties={{
          orderId: summary.order.id,
          uploadCount: summary.uploads.length,
          surface: "sample_ready_page",
        }}
      />
      <section className="sample-frame">
        <span className="pill pill-sun">Free page ready</span>
        <h1>Your sample page is ready to preview.</h1>

        <div className="sample-ready-layout">
          <div className="proof-card proof-card-preview">
            <img alt="Generated coloring page preview" className="proof-card-visual preview-image" src={previewHref} />
            <div className="stack-tight">
              <strong>Free sample preview</strong>
              <p className="muted">This is what your full book will look like.</p>
            </div>
          </div>

          <div className="surface sample-ready-actions">
            <span className="pill pill-coral">Family Memory Book</span>
            <h2>Love the preview? Turn your camera roll into the full book.</h2>
            <p className="muted">{primaryOffer.description}</p>
            <div className="hero-actions">
              <SampleOfferCheckoutButton
                offerCode="pdf-50"
                deliveryMode="pdf"
                sampleOrderId={summary.order.id}
                customerEmail={summary.customer?.email ?? null}
                acquisitionPath="sample_first"
                entrySource="sample-ready-primary"
                className="button button-primary"
              >
                {primaryOffer.ctaLabel}
              </SampleOfferCheckoutButton>
            </div>
            <p className="mini-note">Your preview is saved for 48 hours.</p>
          </div>
        </div>

        <div className="detail-grid three-up">
          {guarantees.slice(0, 3).map((point) => (
            <article className="surface detail-card" key={point.title}>
              <span className="pill pill-mint">{point.title}</span>
              <p className="muted">{point.detail}</p>
            </article>
          ))}
        </div>

        <BookMockupBlock
          coverSrc={proofAssets.kidPhoto}
          pageSrc={proofAssets.kidPage}
          title="Print tonight or turn it into a real keepsake."
          copy="The PDF gets you pages fast. The spiral book turns the same idea into something you can hand to a child, a grandparent, or a birthday guest."
        />

        <div className="stack">
          <div className="section-copy">
            <p className="eyebrow">Want a different size?</p>
            <h2>More options if your photo stack is different.</h2>
            <p className="lede">30 pages is the easiest first book. 100 pages is the best-value keepsake when you want the whole story in one place.</p>
          </div>
          <div className="offer-grid">
            {alternativeOffers.map((offer) => (
              <article className="offer-card" key={offer.code}>
                <div className="offer-card-header">
                  {offer.badge ? <span className={`pill pill-${offer.badgeTone ?? "sun"}`}>{offer.badge}</span> : null}
                  <h3>{offer.title}</h3>
                </div>
                <p className="offer-meta">{offer.designs} personalized coloring pages</p>
                <div className="price-stack">
                  {offer.pdfPrice ? <p>Print Tonight PDF ${offer.pdfPrice}</p> : null}
                  {offer.printPrice ? <p>Giftable Spiral Book ${offer.printPrice}</p> : null}
                </div>
                <p className="offer-description">{offer.description}</p>
                {offer.comparisonNote ? <p className="mini-note">{offer.comparisonNote}</p> : null}
                <SampleOfferCheckoutButton
                  offerCode={offer.code}
                  deliveryMode="pdf"
                  sampleOrderId={summary.order.id}
                  customerEmail={summary.customer?.email ?? null}
                  acquisitionPath="sample_first"
                  entrySource="sample-ready-offer-grid"
                  className="button button-secondary offer-card-cta"
                >
                  {offer.ctaLabel}
                </SampleOfferCheckoutButton>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
