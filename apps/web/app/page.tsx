import { OfferCard } from "../components/offer-card";
import { FaqAccordion } from "../components/faq-accordion";
import { MarketingFooter } from "../components/marketing-footer";
import { MarketingHeader } from "../components/marketing-header";
import { HeroProofModule, ParentQuoteBlock, ProofStrip, UseCaseModule } from "../components/proof-modules";
import { Section } from "../components/section";
import { TrackVisibilityStage } from "../components/track-visibility-stage";
import { TrackedLink } from "../components/tracked-link";
import { consumerOffers, faqs, funnelCtas, guarantees, homepageContent, parentQuotes, useCaseCards } from "../lib/consumer-content";

const coreOffers = consumerOffers.filter((offer) => offer.code === "pdf-30" || offer.code === "pdf-50" || offer.code === "pdf-100");

export default function HomePage() {
  return (
    <main>
      <MarketingHeader />

      <section className="hero-home-shell" id="homepage-proof-module">
        <div className="hero-home-surface">
          <div className="hero-copy hero-home-heading">
            <h1>{homepageContent.hero.title}</h1>
            <p className="lede">{homepageContent.hero.description}</p>
          </div>
          <div className="hero-proof-column">
            <HeroProofModule embedded />
          </div>
          <div className="hero-home-details">
            <div className="hero-home-story">
              <p className="support-note">{homepageContent.hero.supporting}</p>
            </div>
            <div className="hero-home-cta">
              <div className="hero-actions">
                <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName={funnelCtas.freeSample.eventName}>
                  {funnelCtas.freeSample.label}
                </TrackedLink>
              </div>
            </div>
            <div className="hero-home-trust">
              <div className="hero-callout-row">
                {homepageContent.hero.callouts.map((callout) => (
                  <article className={`hero-callout hero-callout-${callout.tone}`} key={callout.title}>
                    <span className="hero-callout-badge">{callout.badge}</span>
                    <strong>{callout.title}</strong>
                    <p>{callout.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <TrackVisibilityStage
        targetId="homepage-proof-module"
        stage="proof_viewed"
        onceKey="homepage-proof-module"
        stageProperties={{
          surface: "homepage_hero_proof",
        }}
      />

      <Section eyebrow="See it work" title={homepageContent.proofStripTitle} copy={homepageContent.proofStripCopy}>
        <ProofStrip />
      </Section>

      <Section
        id="book-sizes"
        eyebrow="Choose your size"
        title="Pick the book size that fits the photos already sitting in your camera roll."
        copy={homepageContent.featuredOfferIntro}
      >
        <div className="offer-grid">
          {coreOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} href="/create?source=homepage-offer-grid&acquisitionPath=direct_buy" />
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
        eyebrow="Why this works"
        title="An easy screen-free win now. A keepsake worth saving later."
        copy="That is the real reason parents say yes. Your child recognizes the people and moments on the page right away, and you still end up with something nice enough to print, gift, and keep."
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
          <div className="hero-actions">
            <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName="home_midpage_sample_clicked">
              {funnelCtas.freeSample.label}
            </TrackedLink>
          </div>
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
        id="faq"
        eyebrow="FAQ"
        title="A few practical questions before you start."
        copy="Everything most moms and grandparents want to know before they try the free page or build the full book."
      >
        <FaqAccordion items={faqs} />
      </Section>

      <MarketingFooter />
    </main>
  );
}
