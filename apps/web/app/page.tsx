import { OfferCard } from "../components/offer-card";
import { FaqAccordion } from "../components/faq-accordion";
import { MarketingFooter } from "../components/marketing-footer";
import { MarketingHeader } from "../components/marketing-header";
import { HeroProofModule, ParentQuoteBlock, ProofStrip, UseCaseModule } from "../components/proof-modules";
import { Section } from "../components/section";
import { TrackVisibilityStage } from "../components/track-visibility-stage";
import { TrackedLink } from "../components/tracked-link";
import { consumerOffers, faqs, founderStoryShort, funnelCtas, guarantees, homepageContent, parentQuotes, useCaseCards } from "../lib/consumer-content";

const coreOffers = consumerOffers.filter((offer) => offer.code === "pdf-30" || offer.code === "pdf-50" || offer.code === "pdf-100");
const heroCallouts = homepageContent.hero.callouts.slice(0, 2);
const homepageFaqs = faqs.slice(0, 6);
const homepageQuotes = parentQuotes.slice(0, 3);

export default function HomePage() {
  return (
    <main>
      <MarketingHeader />

      <section className="hero-home-shell" id="homepage-proof-module">
        <div className="hero-home-surface">
          <div className="hero-copy hero-home-heading">
            <span className="pill pill-coral hero-home-priority">{homepageContent.hero.badge}</span>
            <h1>{homepageContent.hero.title}</h1>
            <p className="lede">Start with one favorite photo or jump straight to the full book. Either way, the goal is the same: familiar family moments become coloring pages kids instantly recognize.</p>
            <div className="hero-actions hero-home-actions">
              <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName={funnelCtas.freeSample.eventName}>
                {funnelCtas.freeSample.label}
              </TrackedLink>
              <TrackedLink
                className="button button-secondary"
                href="/create?offer=pdf-50&source=homepage-builder-primary&acquisitionPath=direct_buy"
                eventName="home_builder_cta_clicked"
              >
                Build My Family Memory Book
              </TrackedLink>
            </div>
            <div className="hero-home-proof-points">
              <span>Start with one favorite photo</span>
              <span>See proof before you buy the full book</span>
              <span>Move to PDF or spiral keepsake next</span>
            </div>
          </div>
          <div className="hero-proof-column">
            <HeroProofModule embedded />
          </div>
          <div className="hero-home-details">
            <article className="surface hero-home-story-card">
              <span className="pill pill-sky">Best first move</span>
              <strong>{homepageContent.hero.supporting}</strong>
              <p className="muted">The free page gives you proof fast. The builder is there for the moments when the gift is already obvious and you just want to keep moving.</p>
            </article>
            <div className="hero-home-cta">
              <div className="surface hero-home-action-card">
                <span className="pill pill-coral">If you already know</span>
                <strong>Go straight to the builder when you already have enough favorite photos for the full keepsake.</strong>
                <p className="muted">Start with 50 when you want the safer full-book choice. Move to 100 when the camera roll is already packed.</p>
                <TrackedLink className="topbar-link" href="#book-sizes" eventName={funnelCtas.seeBookSizes.eventName}>
                  {funnelCtas.seeBookSizes.label}
                </TrackedLink>
              </div>
            </div>
            <div className="hero-home-trust">
              <div className="hero-callout-row hero-callout-row-compact">
                {heroCallouts.map((callout) => (
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

      <Section eyebrow={founderStoryShort.eyebrow} title={founderStoryShort.title}>
        <article className="surface founder-story founder-story-compact">
          {founderStoryShort.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="founder-signature">{founderStoryShort.signature}</p>
        </article>
      </Section>

      <Section
        id="book-sizes"
        eyebrow="Pick your size"
        title="Three sizes. Match one to the camera roll you already have."
        copy={homepageContent.featuredOfferIntro}
      >
        <div className="offer-grid">
          {coreOffers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} href="/create?source=homepage-offer-grid&acquisitionPath=direct_buy" />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Why parents keep coming back"
        title="Easy enough for a Tuesday afternoon. Good enough to gift to grandma."
        copy="That's the whole point. It works on a regular weekday, and it still feels thoughtful enough to show up on a grandparent's coffee table."
      >
        <UseCaseModule items={useCaseCards} />
      </Section>

      <Section
        eyebrow="Why this works"
        title="An easy screen-free win now. A keepsake worth saving later."
        copy="Your kid recognizes the faces on every page. That's why they actually want to color it. You end up with something nice enough to print, gift, and keep."
      >
        <ParentQuoteBlock quotes={homepageQuotes} />
      </Section>

      <Section
        eyebrow="Try the free page first"
        title={homepageContent.sampleBlock.title}
        copy={homepageContent.sampleBlock.description}
      >
        <div className="cta-band">
          <div className="stack-tight">
            <span className="pill pill-sky">One photo is enough to start</span>
            <h3>Get the free page first. Decide after you see it.</h3>
            <p className="muted">No album required up front. One favorite photo, one quick preview, one clear next move if your kid lights up.</p>
          </div>
          <div className="hero-actions">
            <TrackedLink className="button button-primary" href={funnelCtas.freeSample.href} eventName="home_midpage_sample_clicked">
              {funnelCtas.freeSample.label}
            </TrackedLink>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Guaranteed"
        title="The parts we don't want you to worry about."
        copy="Because the fun part is the reaction. Here's how we take every other risk off your plate."
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
        title="Questions parents ask before they upload."
        copy="Timing, print versus PDF, multiple kids, gift copies. The details most parents want before they start."
      >
        <FaqAccordion items={homepageFaqs} />
      </Section>

      <MarketingFooter />
    </main>
  );
}
