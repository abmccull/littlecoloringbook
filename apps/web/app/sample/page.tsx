import { FaqAccordion } from "../../components/faq-accordion";
import { MarketingFooter } from "../../components/marketing-footer";
import { MarketingHeader } from "../../components/marketing-header";
import { SampleStartForm } from "../../components/sample-start-form";
import { BookMockupBlock, PhotoExampleGrid } from "../../components/proof-modules";
import { Section } from "../../components/section";
import { TrackVisibilityStage } from "../../components/track-visibility-stage";
import { TrackPageEvent } from "../../components/track-page-event";
import { TrackedLink } from "../../components/tracked-link";
import { getAcquisitionPayloadFromRecord } from "../../lib/acquisition";
import { faqs, photoExamples, proofAssets } from "../../lib/consumer-content";

const sampleReasons = [
  "You only need one good photo to know whether the style feels like your family.",
  "The sample gives you proof before you ever commit to a full book.",
  "If the sample feels right, you can turn the rest of your favorite photos into the full book next.",
];

const sampleSupportNotes = [
  {
    badge: "Best for",
    title: "One child, one sibling moment, or one favorite pet",
    detail: "Simple, recognizable photos usually make the strongest free sample pages.",
    tone: "sky",
  },
  {
    badge: "Why start here",
    title: "You get proof before you buy the full book",
    detail: "If the sample feels right, the rest of your camera roll can become the full book next.",
    tone: "sun",
  },
] as const;

export default async function SamplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const acquisition = getAcquisitionPayloadFromRecord(await searchParams, "sample_first", "sample-page");

  return (
    <main>
      <TrackPageEvent eventName="sample_entry_viewed" />
      <MarketingHeader subtitle="free sample page" />

      <section className="sample-frame sample-entry">
        <div className="sample-entry-copy">
          <div className="hero-home-heading">
            <span className="pill pill-sun">Free sample</span>
            <h1>Turn one photo they already love into a free coloring page.</h1>
            <p className="lede">
              Start with one favorite photo first. If the page feels like them, you can turn the rest of your camera roll into the full book right after that.
            </p>
          </div>
          <ul className="feature-list">
            <li>One free sample page from one favorite photo</li>
            <li>Best for a child portrait, a sibling moment, or a favorite pet</li>
            <li>If your child loves it, you are one step away from the full book.</li>
          </ul>
          <div className="sample-entry-support-grid">
            {sampleSupportNotes.map((note) => (
              <article className={`sample-entry-note sample-entry-note-${note.tone}`} key={note.title}>
                <span className="sample-entry-note-badge">{note.badge}</span>
                <strong>{note.title}</strong>
                <p>{note.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="surface sample-form-card">
          <span className="pill pill-coral">Start here</span>
          <h3>Tell us where to send it.</h3>
          <p className="muted">You&apos;ll upload the photo on the next screen. This first step just keeps your free page connected to the right inbox.</p>
          <SampleStartForm acquisition={acquisition} />
          <p className="mini-note">
            Already know you want the full book?{" "}
            <TrackedLink href="/create?offer=pdf-100&source=sample-bypass&acquisitionPath=direct_buy" eventName="sample_page_direct_builder_clicked">
              Skip the sample and build it now.
            </TrackedLink>
          </p>
        </div>
      </section>

      <Section
        eyebrow="Best photo choices"
        title="Stronger source photos create stronger coloring pages."
        copy="A few good examples make this easier than guessing what kind of photo to upload."
      >
        <PhotoExampleGrid examples={photoExamples} />
      </Section>

      <Section
        eyebrow="What happens next"
        title="One good sample page makes the full book feel obvious."
        copy="That is the whole point of the free page. You get to see your own photo in the style first, then decide whether you want to turn the rest of your camera roll into the full book."
      >
        <div className="detail-grid three-up">
          {sampleReasons.map((reason, index) => (
            <article className="surface detail-card" key={reason}>
              <span className="pill pill-sky">Step {index + 1}</span>
              <p className="muted">{reason}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="What comes next"
        title="If the sample feels like a yes, turn the rest of your camera roll into the full book."
        copy="Start with 30 if you want the easiest first book. Move up to 50 when you want it to feel fuller. Choose 100 when you want the best keepsake value and enough room for the whole story."
      >
        <div id="sample-page-proof-module">
          <BookMockupBlock
            badge="Real photo to real keepsake"
            coverSrc={proofAssets.realSwordPlayPhoto}
            pageSrc={proofAssets.realSwordPlayPage}
            title="Print tonight first, or order the spiral book worth keeping."
            copy="The same personalized pages can be a quick PDF for today or a spiral-bound book for birthdays, grandparents, and shelf-worthy family keepsakes."
          />
        </div>
      </Section>
      <TrackVisibilityStage
        targetId="sample-page-proof-module"
        stage="proof_viewed"
        onceKey="sample-page-proof-module"
        stageProperties={{
          surface: "sample_page_book_mockup",
        }}
      />

      <Section
        id="faq"
        eyebrow="FAQ"
        title="Questions moms and grandparents usually ask before they start."
        copy="Timing, print versus PDF, multiple kids, gift copies, and the practical details most people want before they upload."
      >
        <FaqAccordion items={faqs} />
      </Section>

      <MarketingFooter />
    </main>
  );
}
