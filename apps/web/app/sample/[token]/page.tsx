import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { OfferCard } from "../../../components/offer-card";
import { BookMockupBlock } from "../../../components/proof-modules";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../../components/track-page-event";
import { TrackedLink } from "../../../components/tracked-link";
import { consumerOffers, funnelCtas, getConsumerOffer, guarantees, proofAssets } from "../../../lib/consumer-content";

type SampleReadyPageProps = {
  params: Promise<{ token: string }>;
};

const coreOffers = consumerOffers.filter((offer) => offer.code === "pdf-30" || offer.code === "pdf-50" || offer.code === "pdf-100");

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
  const featuredOffer = getConsumerOffer("pdf-100");
  const downsellOffer = getConsumerOffer("pdf-10");

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
        <p className="lede">If your child lights up when they see this, turn the rest of your camera roll into the full book. Start with 30, move to 50 if the album is fuller, or go to 100 if you want the best-value keepsake.</p>

        <div className="sample-ready-layout">
          <div className="proof-card proof-card-preview">
            <img alt="Generated coloring page preview" className="proof-card-visual preview-image" src={previewHref} />
            <div className="stack-tight">
              <strong>Free sample preview</strong>
              <p className="muted">This is what the full book style will feel like on your own photos.</p>
            </div>
          </div>

          <div className="surface sample-ready-actions">
            <span className="pill pill-coral">Best-value keepsake</span>
            <h3>{featuredOffer.title} is the fullest version and the best value if your photo stack is ready.</h3>
            <p className="muted">It is the strongest fit for bigger camera rolls, sibling stories, trips, birthday memories, and gift copies.</p>
            <div className="hero-actions">
              <TrackedLink className="button button-primary" href={funnelCtas.startThirtyPdf.href} eventName={funnelCtas.startThirtyPdf.eventName}>
                {funnelCtas.startThirtyPdf.label}
              </TrackedLink>
              <TrackedLink className="button button-secondary" href={funnelCtas.addThirtyPrint.href} eventName={funnelCtas.addThirtyPrint.eventName}>
                {funnelCtas.addThirtyPrint.label}
              </TrackedLink>
            </div>
            <p className="muted">
              Want to sit with the sample a little longer?{" "}
              <a href={previewHref} rel="noreferrer" target="_blank">
                Open the sample preview.
              </a>
            </p>
            <p className="muted">
              Want the lighter first version instead?{" "}
              <TrackedLink href={funnelCtas.startMiniPdf.href} eventName={funnelCtas.startMiniPdf.eventName}>
                {funnelCtas.startMiniPdf.label}
              </TrackedLink>
            </p>
          </div>
        </div>

        <BookMockupBlock
          coverSrc={proofAssets.kidPhoto}
          pageSrc={proofAssets.kidPage}
          title="Print tonight or turn it into a real keepsake."
          copy="The PDF gets you pages fast. The spiral book turns the same idea into something you can hand to a child, a grandparent, or a birthday guest."
        />

        <div className="detail-grid three-up">
          {guarantees.slice(0, 3).map((point) => (
            <article className="surface detail-card" key={point.title}>
              <span className="pill pill-mint">{point.title}</span>
              <p className="muted">{point.detail}</p>
            </article>
          ))}
        </div>

        <div className="stack">
          <div className="section-copy">
            <p className="eyebrow">Choose your size</p>
            <h2>Start light with 30, or go bigger if the photo stack is ready.</h2>
            <p className="lede">30 is the good starter, 50 is the fuller middle, and 100 is the best-value keepsake when you already know you want the whole story in one book.</p>
          </div>
          <div className="offer-grid">
            {coreOffers.map((offer) => (
              <OfferCard key={offer.code} offer={offer} />
            ))}
            <OfferCard offer={downsellOffer} buttonLabel="Keep it smaller" />
          </div>
        </div>
      </section>
    </main>
  );
}
