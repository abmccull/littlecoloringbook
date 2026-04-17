import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { BrandLogo } from "../../../components/brand-logo";
import { BundleSaveCards } from "../../../components/bundle-save-cards";
import { GiftCopiesUpsell } from "../../../components/gift-copies-upsell";
import { BookMockupBlock } from "../../../components/proof-modules";
import { SampleOfferCheckoutButton } from "../../../components/sample-offer-checkout-button";
import { TrackBuyerJourneyStage } from "../../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../../components/track-page-event";
import { consumerOffers, getConsumerOffer, guarantees, proofAssets } from "../../../lib/consumer-content";

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
              <SampleOfferCheckoutButton
                offerCode="pdf-100"
                deliveryMode="pdf"
                sampleOrderId={summary.order.id}
                customerEmail={summary.customer?.email ?? null}
                acquisitionPath="sample_first"
                entrySource="sample-ready-primary"
                className="button button-primary"
              >
                Build The 100-Page Book
              </SampleOfferCheckoutButton>
              <SampleOfferCheckoutButton
                offerCode="print-100"
                deliveryMode="print"
                sampleOrderId={summary.order.id}
                customerEmail={summary.customer?.email ?? null}
                acquisitionPath="sample_first"
                entrySource="sample-ready-print"
                className="button button-secondary"
              >
                Get The Spiral Book Version
              </SampleOfferCheckoutButton>
            </div>
            <p className="muted">
              Want to sit with the sample a little longer?{" "}
              <a href={previewHref} rel="noreferrer" target="_blank">
                Open the sample preview.
              </a>
            </p>
            <p className="muted">
              Want the lighter first version instead?{" "}
              <SampleOfferCheckoutButton
                offerCode="pdf-10"
                deliveryMode="pdf"
                sampleOrderId={summary.order.id}
                customerEmail={summary.customer?.email ?? null}
                acquisitionPath="sample_first"
                entrySource="sample-ready-downsell"
                className="button-link"
              >
                Keep It Light With 10 Pages
              </SampleOfferCheckoutButton>
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
              <article className={`offer-card${offer.code === "pdf-50" ? " is-featured" : ""}`} key={offer.code}>
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
                  className={`button ${offer.code === "pdf-50" ? "button-primary" : "button-secondary"} offer-card-cta`}
                >
                  {offer.ctaLabel}
                </SampleOfferCheckoutButton>
              </article>
            ))}
            <article className="offer-card">
              <div className="offer-card-header">
                {downsellOffer.badge ? <span className={`pill pill-${downsellOffer.badgeTone ?? "sun"}`}>{downsellOffer.badge}</span> : null}
                <h3>{downsellOffer.title}</h3>
              </div>
              <p className="offer-meta">{downsellOffer.designs} personalized coloring pages</p>
              <div className="price-stack">
                {downsellOffer.pdfPrice ? <p>Print Tonight PDF ${downsellOffer.pdfPrice}</p> : null}
              </div>
              <p className="offer-description">{downsellOffer.description}</p>
              {downsellOffer.comparisonNote ? <p className="mini-note">{downsellOffer.comparisonNote}</p> : null}
              <SampleOfferCheckoutButton
                offerCode={downsellOffer.code}
                deliveryMode="pdf"
                sampleOrderId={summary.order.id}
                customerEmail={summary.customer?.email ?? null}
                acquisitionPath="sample_first"
                entrySource="sample-ready-offer-grid"
                className="button button-secondary offer-card-cta"
              >
                Keep it smaller
              </SampleOfferCheckoutButton>
            </article>
          </div>
        </div>

        <GiftCopiesUpsell baseHref="/create?source=sample-ready-gift-upsell&acquisitionPath=sample_first" />

        <BundleSaveCards baseHref="/create?source=sample-ready-bundle-upsell&acquisitionPath=sample_first" />
      </section>
    </main>
  );
}
