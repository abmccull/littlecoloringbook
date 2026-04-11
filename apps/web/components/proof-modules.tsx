import { BrandLogo } from "./brand-logo";
import { BeforeAfterSlider } from "./before-after-slider";
import { proofAssets, type ParentQuote, type PhotoExample, type UseCaseCard } from "../lib/consumer-content";

type ProofStep = {
  label: string;
  caption: string;
  alt: string;
  frame: "photo" | "page" | "book";
  note?: string;
  src?: string;
  coverSrc?: string;
  pageSrc?: string;
};

const heroSteps: ProofStep[] = [
  {
    label: "Start with a real family moment",
    caption: "This kind of everyday photo is exactly what makes the book feel personal",
    src: proofAssets.realSwordPlayPhoto,
    alt: "Real photo of two kids playing with toy swords",
    frame: "photo",
  },
  {
    label: "We turn it into clean, colorable lines",
    caption: "The scene stays recognizable, but the page becomes simple enough to color",
    src: proofAssets.realSwordPlayPage,
    alt: "Real coloring page generated from the photo of two kids playing",
    frame: "page",
  },
  {
    label: "Keep it as a spiral book worth saving",
    caption: "The same favorite photo becomes a coil-bound keepsake that feels giftable on the shelf",
    alt: "Sample spiral bound book mockup using the real family photo and coloring page",
    frame: "book",
    note: "Every spiral book includes the PDF too",
    coverSrc: proofAssets.realSwordPlayPhoto,
    pageSrc: proofAssets.realSwordPlayPage,
  },
];

export function HeroProofModule({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={`hero-proof-panel hero-showcase-panel${embedded ? " hero-showcase-panel-embedded" : ""}`}>
      <div className="hero-showcase-topline">
        <span className="pill pill-sun">Real photo to real coloring page</span>
      </div>

      <div className="hero-showcase-stage">
        <BeforeAfterSlider afterSrc={proofAssets.realFamilyPlayPage} beforeSrc={proofAssets.realFamilyPlayPhoto} />
      </div>
    </div>
  );
}

export function ProofStrip() {
  return (
    <div className="proof-strip">
      {heroSteps.map((step, index) => (
        <article className={`proof-strip-item proof-strip-item-${step.frame}`} key={step.label}>
          <div className="proof-strip-topline">
            <span className="proof-step-index">0{index + 1}</span>
            <span className="mini-note">{step.frame === "book" ? "What you keep" : step.frame === "page" ? "What they color" : "What you start with"}</span>
          </div>
          {step.frame === "book" ? (
            <div aria-label={step.alt} className="proof-strip-book-preview" role="img">
              <div className="proof-strip-book-spiral" aria-hidden="true" />
              <div className="proof-strip-book-cover">
                <img alt="" src={step.coverSrc} />
                <div className="book-cover-badge">
                  <BrandLogo size="cover" />
                </div>
                <div className="book-cover-footer">
                  <strong>Personalized Coloring Book</strong>
                </div>
              </div>
              <div className="proof-strip-book-page">
                <img alt="" src={step.pageSrc} />
              </div>
            </div>
          ) : (
            <img alt={step.alt} className="proof-strip-image" src={step.src} />
          )}
          <div className="stack-tight">
            <strong>{step.label}</strong>
            <p className="muted">{step.caption}</p>
            {step.note ? <p className="mini-note">{step.note}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function BookMockupBlock({
  badge = "Photo-to-book preview",
  coverSrc = proofAssets.kidPhoto,
  pageSrc = proofAssets.kidPage,
  title,
  copy,
}: {
  badge?: string;
  coverSrc?: string;
  pageSrc?: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="book-mockup-block">
      <div className="book-mockup">
        <div className="book-spiral" aria-hidden="true" />
        <div className="book-cover">
          <img alt="Example personalized book cover" src={coverSrc} />
          <div className="book-cover-badge">
            <BrandLogo size="cover" />
          </div>
          <div className="book-cover-footer">
            <strong>Personalized Coloring Book</strong>
          </div>
        </div>
        <div className="book-page">
          <img alt="Example inner coloring page" src={pageSrc} />
        </div>
      </div>
      <div className="stack-tight">
        <span className="pill pill-mint">{badge}</span>
        <h3>{title}</h3>
        <p className="muted">{copy}</p>
      </div>
    </div>
  );
}

export function PhotoExampleGrid({ examples }: { examples: PhotoExample[] }) {
  return (
    <div className="photo-example-grid">
      {examples.map((example) => (
        <article className="photo-example-card" key={example.label}>
          <img alt={example.alt} className="photo-example-image" src={example.src} />
          <div className="stack-tight">
            <strong>{example.label}</strong>
            <p className="muted">{example.tip}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ParentQuoteBlock({ quotes }: { quotes: ParentQuote[] }) {
  return (
    <div className="parent-quote-grid">
      {quotes.map((quote) => (
        <blockquote className="parent-quote" key={quote.quote}>
          <p>&ldquo;{quote.quote}&rdquo;</p>
          <footer>
            <strong>{quote.name}</strong>
            <span>{quote.context}</span>
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

export function UseCaseModule({ items }: { items: UseCaseCard[] }) {
  return (
    <div className="use-case-grid">
      {items.map((item) => (
        <article className={`use-case-card use-case-card-${item.tone}`} key={item.title}>
          <h3>{item.title}</h3>
          <p className="muted">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
