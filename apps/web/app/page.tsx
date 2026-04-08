import { OfferCard } from "../components/offer-card";
import { Section } from "../components/section";
import { TrackedLink } from "../components/tracked-link";
import { featuredOffers, faqs, proofExamples, trustPoints, useCases } from "../lib/offers";

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>family photos into coloring books</span>
        </div>
        <TrackedLink className="button button-secondary" href="/create" eventName="home_build_book_clicked">
          Build a Book
        </TrackedLink>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill">Screen-free keepsake</span>
          <h1>Turn your family photos into a coloring book your child will love.</h1>
          <p className="lede">
            Upload favorite photos and get a personalized coloring book as a print-at-home PDF or a spiral-bound book delivered to your door.
          </p>
          <div className="hero-actions">
            <TrackedLink className="button button-primary" href="/sample" eventName="home_sample_cta_clicked">
              Get Your Free Sample Page
            </TrackedLink>
            <TrackedLink className="button button-secondary" href="#offers" eventName="home_examples_clicked">
              See Example Books
            </TrackedLink>
          </div>
          <div className="trust-row">
            {trustPoints.map((point) => (
              <div className="trust-pill" key={point}>
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="hero-proof">
          <div>
            <span className="pill">Proof of style</span>
            <p className="lede" style={{ marginTop: 12 }}>
              Start with one photo. See the style before you decide on a full book.
            </p>
          </div>
          <div className="mock-preview-grid">
            {proofExamples.slice(0, 2).map((item) => (
              <div className="mock-preview" key={item.title}>
                <div className="scribble" />
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{"Before -> line-art page -> child colors it."}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section
        eyebrow="How it works"
        title="A guided flow, not a generic AI tool."
        copy="The product stays opinionated on purpose: strong outlines, simple layouts, one clear print format, and a low-friction buying path."
      >
        <div className="how-grid">
          <div className="how-step">
            <span className="pill">1</span>
            <h3>Upload photos</h3>
            <p>Start with one photo for a free sample, or upload a fuller album once you are ready to buy.</p>
          </div>
          <div className="how-step">
            <span className="pill">2</span>
            <h3>We turn them into child-friendly pages</h3>
            <p>Each page is cleaned for bold outlines, open coloring space, and print-safe margins.</p>
          </div>
          <div className="how-step">
            <span className="pill">3</span>
            <h3>Choose PDF or spiral book</h3>
            <p>Print at home the same day, or upgrade to a spiral-bound keepsake shipped to your door.</p>
          </div>
        </div>
      </Section>

      <Section
        id="offers"
        eyebrow="Offer ladder"
        title="Lead with the 30-page book, then let customers trade up."
        copy="The main merchandising strategy is simple: the 30-design offer is the default, 50 is the strongest upsell, and 100 is the value anchor."
      >
        <div className="offer-grid">
          {featuredOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Before and after"
        title="Make the proof visual and concrete."
        copy="The site should show real-photo inputs transformed into pages that still feel personal, not generic."
      >
        <div className="proof-grid">
          {proofExamples.map((item) => (
            <article className="proof-card" key={item.title}>
              <div className="proof-card-visual" />
              <h3>{item.title}</h3>
              <p className="muted">{item.blurb}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Use cases"
        title="Position the product as both an activity and a gift."
        copy="The same system supports everyday family use, birthdays, holidays, grandparents, pets, and post-trip memory books."
      >
        <div className="use-case-grid">
          {useCases.map((item) => (
            <div className="use-case" key={item}>
              {item}
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Guarantees"
        title="Reduce purchase anxiety with operational promises."
        copy="The free sample proves the style. Paid orders include limited rerenders. Printed books that arrive damaged or misprinted should be replaced."
      >
        <div className="stat-row">
          <div className="surface">
            <span className="pill">Preview Promise</span>
            <h3>See the style before you commit to print.</h3>
          </div>
          <div className="surface">
            <span className="pill">Redo Promise</span>
            <h3>If a few pages miss, rerender up to 3 pages free.</h3>
          </div>
          <div className="surface">
            <span className="pill">Arrival Promise</span>
            <h3>Damaged or misprinted books get replaced.</h3>
          </div>
          <div className="surface">
            <span className="pill">Fast PDF</span>
            <h3>Digital books are targeted for minutes, not days.</h3>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="FAQ"
        title="Answer the objections early."
        copy="The launch doc and PRD already define the core buyer questions. Surface them on the homepage instead of hiding them below the fold."
      >
        <div className="faq-grid">
          {faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <h3>{faq.question}</h3>
              <p className="muted">{faq.answer}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Start here"
        title="Start with a free page from your favorite photo."
        copy="Do not ask cold traffic to upload 10 photos immediately. Prove the value first, then move them into the 30-design upgrade path."
      >
        <div className="hero-actions">
          <TrackedLink className="button button-primary" href="/sample" eventName="home_footer_sample_cta_clicked">
            Get Your Free Sample Page
          </TrackedLink>
          <TrackedLink className="button button-secondary" href="/create" eventName="home_footer_builder_clicked">
            Skip to the Builder
          </TrackedLink>
        </div>
      </Section>

      <p className="footer-note">littlecolorbook.com v0 scaffold. Next step is wiring real uploads, jobs, payments, and fulfillment.</p>
    </main>
  );
}
