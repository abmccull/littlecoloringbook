import { proofAssets, type ParentQuote, type PhotoExample, type UseCaseCard } from "../lib/consumer-content";

type ProofStep = {
  label: string;
  caption: string;
  src: string;
  alt: string;
  frame: "photo" | "page" | "book";
  note?: string;
};

const heroSteps: ProofStep[] = [
  {
    label: "Pick one favorite photo",
    caption: "The kind already sitting in your camera roll",
    src: proofAssets.kidPhoto,
    alt: "Demo photo of a child",
    frame: "photo",
  },
  {
    label: "We turn it into clean, colorable lines",
    caption: "Bold enough for little hands, personal enough to feel like them",
    src: proofAssets.kidPage,
    alt: "Example coloring page output",
    frame: "page",
  },
  {
    label: "Choose the quick version or the keepsake version",
    caption: "Print tonight as a PDF or order the spiral book for later",
    src: proofAssets.petPhoto,
    alt: "Printed spiral book cover mockup",
    frame: "book",
    note: "Every spiral book includes the PDF too",
  },
];

export function HeroProofModule() {
  return (
    <div className="hero-proof-panel">
      <div className="hero-proof-feature">
        <div className="hero-proof-heading">
          <span className="hand-note">Real product proof using licensed demo images</span>
          <h3>See how one favorite photo becomes a page they will actually want to color.</h3>
          <p className="muted">
            This is the part parents need to see. One real photo turns into bold, open lines a child can color now and you can still feel good saving later.
          </p>
        </div>
        <div className="hero-proof-comparison">
          <div className="proof-stage proof-stage-photo">
            <span className="pill pill-sky">Photo</span>
            <img
              alt="Example family photo used as the source image"
              className="hero-proof-feature-image"
              src={proofAssets.familyPhoto}
            />
          </div>
          <div className="proof-stage proof-stage-page">
            <span className="pill pill-coral">Coloring page</span>
            <img
              alt="Example transformation showing a source family photo converted into a coloring page"
              className="hero-proof-feature-image"
              src={proofAssets.exampleTransformation}
            />
          </div>
        </div>
      </div>
      <div className="proof-steps-grid">
        {heroSteps.map((step, index) => (
          <article className={`proof-step-card proof-step-card-${step.frame}`} key={step.label}>
            <span className="proof-step-index">0{index + 1}</span>
            <img alt={step.alt} className="proof-step-image" src={step.src} />
            <div className="stack-tight">
              <strong>{step.label}</strong>
              <p className="muted">{step.caption}</p>
              {step.note ? <span className="mini-note">{step.note}</span> : null}
            </div>
          </article>
        ))}
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
          <img alt={step.alt} className="proof-strip-image" src={step.src} />
          <div className="stack-tight">
            <strong>{step.label}</strong>
            <p className="muted">{step.caption}</p>
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
          <span className="book-cover-badge">Little Color Book</span>
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
