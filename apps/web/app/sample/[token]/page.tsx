import { notFound, redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { OfferCard } from "../../../components/offer-card";
import { BookMockupBlock } from "../../../components/proof-modules";
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
      <TrackPageEvent
        eventName="sample_ready_viewed"
        eventProperties={{
          orderId: summary.order.id,
          selectedOffer: summary.order.selectedOfferCode,
          uploadCount: summary.uploads.length,
        }}
      />
      <section className="sample-frame">
        <span className="pill pill-sun">Free page ready</span>
        <h1>Your sample page is ready to preview.</h1>
        <p className="lede">If this feels like a yes, choose the book size that matches your photo stack. 30 pages is the entry book. 100 pages is the best value.</p>

        <div className="sample-ready-layout">
          <div className="proof-card proof-card-preview">
            <img alt="Generated coloring page preview" className="proof-card-visual preview-image" src={previewHref} />
            <div className="stack-tight">
              <strong>Free sample preview</strong>
              <p className="muted">This is the proof step: see the style on your own photo before committing to a full book.</p>
            </div>
          </div>

          <div className="surface sample-ready-actions">
            <span className="pill pill-coral">Best value option</span>
            <h3>{featuredOffer.title} gives you the fullest book for the best per-page value.</h3>
            <p className="muted">{featuredOffer.description}</p>
            <div className="hero-actions">
              <TrackedLink className="button button-primary" href={funnelCtas.startThirtyPdf.href} eventName={funnelCtas.startThirtyPdf.eventName}>
                {funnelCtas.startThirtyPdf.label}
              </TrackedLink>
              <TrackedLink className="button button-secondary" href={funnelCtas.addThirtyPrint.href} eventName={funnelCtas.addThirtyPrint.eventName}>
                {funnelCtas.addThirtyPrint.label}
              </TrackedLink>
            </div>
            <p className="muted">
              Want to look at the page again first?{" "}
              <a href={previewHref} rel="noreferrer" target="_blank">
                Open the sample preview.
              </a>
            </p>
            <p className="muted">
              Need a smaller first step?{" "}
              <TrackedLink href={funnelCtas.startMiniPdf.href} eventName={funnelCtas.startMiniPdf.eventName}>
                {funnelCtas.startMiniPdf.label}
              </TrackedLink>
            </p>
          </div>
        </div>

        <BookMockupBlock
          coverSrc={proofAssets.kidPhoto}
          pageSrc={proofAssets.kidPage}
          title="Print tonight or make it giftable."
          copy="The PDF gets you pages fast. The spiral book turns the same idea into a keepsake you can hand to a child, grandparent, or birthday guest."
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
            <h2>Keep 30 available. Step up to 50 or 100 when you want more book.</h2>
            <p className="lede">30 pages keeps the first purchase lighter. 50 pages is the middle ground. 100 pages is the strongest value.</p>
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
