import { TrackedLink } from "./tracked-link";

type BundleSaveCardsProps = {
  baseHref?: string;
};

type BundleTier = {
  bundleCode: string;
  label: string;
  quantity: number;
  pillTone: "mint" | "coral" | "sun";
  tagline: string;
  description: string;
  ctaLabel: string;
  savingsNote: string;
};

const bundleTiers: BundleTier[] = [
  {
    bundleCode: "set-of-2",
    label: "Two-copy bundle",
    quantity: 2,
    pillTone: "mint",
    tagline: "One for home, one for grandma.",
    description:
      "Two identical spiral books from the same set of pages. Great for siblings, a keep-safe copy alongside an everyday copy, or gifting without reordering.",
    ctaLabel: "Get the 2-copy bundle",
    savingsNote: "Cheaper than ordering a second book later.",
  },
  {
    bundleCode: "set-of-3",
    label: "Three-copy bundle",
    quantity: 3,
    pillTone: "coral",
    tagline: "The right move for bigger families.",
    description:
      "Three printed copies — enough for both grandparent households, a birthday gift copy, or sibling sets without going back through the whole process.",
    ctaLabel: "Get the 3-copy bundle",
    savingsNote: "Best per-copy price of any print pack.",
  },
];

export function BundleSaveCards({ baseHref = "/create" }: BundleSaveCardsProps) {
  const separator = baseHref.includes("?") ? "&" : "?";

  return (
    <div className="stack">
      <div className="section-copy">
        <p className="eyebrow">Bundle and save</p>
        <h2>Order extra copies while the pages only need to be made once.</h2>
        <p className="lede">
          Extra spiral books cost less when they are ordered together because the pages are already done. The cheapest time to add grandparent and sibling copies is right now.
        </p>
      </div>
      <div className="detail-grid two-up">
        {bundleTiers.map((tier) => (
          <article className="surface detail-card" key={tier.bundleCode}>
            <span className={`pill pill-${tier.pillTone}`}>{tier.label}</span>
            <h3>{tier.tagline}</h3>
            <p className="muted">{tier.description}</p>
            <p className="mini-note">{tier.savingsNote}</p>
            <TrackedLink
              className="button button-secondary offer-card-cta"
              href={`${baseHref}${separator}offer=print-100&bundle=${encodeURIComponent(tier.bundleCode)}&source=sample-bundle-upsell`}
              eventName="bundle_upsell_clicked"
              eventProperties={{
                bundleCode: tier.bundleCode,
                quantity: tier.quantity,
                surface: "sample_ready_page",
              }}
            >
              {tier.ctaLabel}
            </TrackedLink>
          </article>
        ))}
      </div>
    </div>
  );
}
