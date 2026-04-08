import type { Offer } from "../lib/offers";
import { TrackedLink } from "./tracked-link";

type OfferCardProps = {
  offer: Offer;
  href?: string;
};

export function OfferCard({ offer, href = "/create" }: OfferCardProps) {
  return (
    <article className="offer-card">
      <div className="offer-card-header">
        {offer.badge ? <span className="pill">{offer.badge}</span> : null}
        <h3>{offer.name}</h3>
      </div>
      <p className="offer-meta">{offer.designs} personalized designs</p>
      <div className="price-stack">
        {offer.pdfPrice ? <p>PDF ${offer.pdfPrice}</p> : null}
        {offer.printPrice ? <p>Print + PDF ${offer.printPrice}</p> : null}
      </div>
      <p className="offer-description">{offer.description}</p>
      <TrackedLink
        className="button button-secondary"
        href={`${href}?offer=${offer.code}`}
        eventName="offer_card_clicked"
        eventProperties={{
          offerCode: offer.code,
          offerName: offer.name,
          designs: offer.designs,
          destination: href,
        }}
      >
        Start This Book
      </TrackedLink>
    </article>
  );
}
