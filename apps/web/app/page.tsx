import { OfferCard } from "../components/offer-card";
import { FaqAccordion } from "../components/faq-accordion";
import { HeroProofModule, ParentQuoteBlock, ProofStrip, UseCaseModule } from "../components/proof-modules";
import { Section } from "../components/section";
import { TrackedLink } from "../components/tracked-link";
import { consumerOffers, faqs, funnelCtas, guarantees, homepageContent, parentQuotes, useCaseCards } from "../lib/consumer-content";

const coreOffers = consumerOffers.filter((offer) => offer.code === "pdf-30" || offer.code === "pdf-50" || offer.code === "pdf-100");

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>personalized coloring books from your photos</span>
        </div>
        <TrackedLink className="button button-secondary" href={funnelCtas.freeSample.href} eventName="home_header_sample_clicked">
          {funnelCtas.freeSample.label}
        </TrackedLink>
      </header>

      <section className="hero hero-home">
        <div className="hero-copy">
          <span className="pill pill-sun">{homepageContent.hero.badge}</span>
          <h1>{homepageContent.hero.title}</h1>
          <p className="lede">{homepageContent.hero.description}</p>
          <p className="support-note">{homepageContent.hero.supporting}</p>
          <div className="hero-actions">
            <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName={funnelCtas.freeSample.eventName}>
              {funnelCtas.freeSample.label}
            </TrackedLink>
            <TrackedLink className="button button-secondary" href={funnelCtas.seeThirtyPages.href} eventName={funnelCtas.seeThirtyPages.eventName}>
              {funnelCtas.seeThirtyPages.label}
            </TrackedLink>
          </div>
          <div className="trust-row">
            {homepageContent.hero.trustPoints.map((point) => (
              <div className="trust-pill" key={point}>
                {point}
              </div>
            ))}
          </div>
        </div>

        <HeroProofModule />
      </section>

      <Section eyebrow="See it work" title={homepageContent.proofStripTitle} copy="One favorite photo becomes a coloring page, then a book worth keeping." >
        <ProofStrip />
      </Section>

      <Section
        eyebrow="Choose your size"
        title="Good: 30 pages. Better: 50 pages. Best: 100 pages."
        copy={homepageContent.featuredOfferIntro}
      >
        <div className="offer-grid">
          {coreOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Why moms love this"
        title="It gives you something easy for now and something sweet to keep later."
        copy="That is the real magic: it works on a regular weekday, but it still feels thoughtful enough to gift."
      >
        <UseCaseModule items={useCaseCards} />
      </Section>

      <Section
        eyebrow="How it feels"
        title="This should feel like an easy yes, not one more thing on your list."
        copy="The free sample keeps the decision low-pressure. You get to see your own photo in the style before you commit."
      >
        <ParentQuoteBlock quotes={parentQuotes} />
      </Section>

      <Section
        eyebrow="Free sample first"
        title={homepageContent.sampleBlock.title}
        copy={homepageContent.sampleBlock.description}
      >
        <div className="cta-band">
          <div className="stack-tight">
            <span className="pill pill-sky">One photo is enough to start</span>
            <h3>Get the free page first. Decide after you see it.</h3>
            <p className="muted">No full album required up front. Just one favorite photo, one quick preview, and a clear next move if your child lights up.</p>
          </div>
          <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName="home_midpage_sample_clicked">
            {funnelCtas.freeSample.label}
          </TrackedLink>
        </div>
      </Section>

      <Section
        eyebrow="Guarantee"
        title="The practical details that make this easy to trust."
        copy="The fun part should stay front and center. These are the details that keep the purchase low-stress."
      >
        <div className="detail-grid three-up">
          {guarantees.map((item) => (
            <article className="surface detail-card" key={item.title}>
              <span className="pill pill-mint">{item.title}</span>
              <p className="muted">{item.detail}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="FAQ"
        title="A few practical questions before you start."
        copy="Everything most moms and grandparents want to know before they try the free page or build the full book."
      >
        <FaqAccordion items={faqs} />
      </Section>
    </main>
  );
}
