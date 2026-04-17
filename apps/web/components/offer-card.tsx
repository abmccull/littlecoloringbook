import type { ConsumerOffer } from "../lib/consumer-content";
import { TrackedLink } from "./tracked-link";

type OfferCardProps = {
  offer: ConsumerOffer;
  href?: string;
  buttonLabel?: string;
  /**
   * Override whether this card renders with the featured (highlighted) treatment.
   * When not provided, falls back to `offer.featured`.
   */
  featured?: boolean;
};

export function OfferCard({ offer, href = "/create", buttonLabel, featured }: OfferCardProps) {
  const separator = href.includes("?") ? "&" : "?";
  const destinationHref = `${href}${separator}offer=${offer.code}`;
  const isFeatured = featured !== undefined ? featured : offer.featured;

  return (
    <article className={`offer-card${isFeatured ? " is-featured" : ""}`}>
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
      <TrackedLink
        className={`button ${isFeatured ? "button-primary" : "button-secondary"} offer-card-cta`}
        href={destinationHref}
        eventName="offer_card_clicked"
        eventProperties={{
          offerCode: offer.code,
          offerName: offer.title,
          designs: offer.designs,
          destination: href,
        }}
      >
        {buttonLabel ?? offer.ctaLabel}
      </TrackedLink>
    </article>
  );
}
