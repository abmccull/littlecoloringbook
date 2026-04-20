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
import { faqs, founderStoryShort, photoExamples, proofAssets } from "../../lib/consumer-content";

const sampleReasons = [
  "One good photo is enough to see whether the style feels like your family.",
  "You get proof before you spend a dollar on the full book.",
  "If the sample lands, the rest of your favorite photos become the full book next.",
];

const sampleSupportNotes = [
  {
    badge: "Best for",
    title: "One child, one sibling moment, or one favorite pet",
    detail: "Simple, recognizable photos turn into the cleanest coloring pages. No studio shot required.",
    tone: "sky",
  },
  {
    badge: "Why start here",
    title: "See proof before you buy the book",
    detail: "If the sample feels right, the rest of your camera roll becomes the book in minutes.",
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
          <span className="pill pill-sun">Free sample</span>
          <h1>One photo of your kid. One free coloring page they'll actually want to color.</h1>
          <p className="lede">
            Start with one favorite photo. If the page feels like them, the rest of your camera roll becomes the full book on the next screen.
          </p>
          <ul className="feature-list">
            <li>One free sample page from one favorite photo</li>
            <li>Works best with a child portrait, a sibling moment, or a favorite pet</li>
            <li>If they light up, the full book is one step away</li>
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
          <h3>See your photo become a coloring page in about 30 seconds.</h3>
          <p className="muted">We&apos;ll email you the finished page so you never lose it. You&apos;ll upload the photo on the next screen.</p>
          <SampleStartForm acquisition={acquisition} />
          <p className="mini-note">
            Already know you want the full book?{" "}
            <TrackedLink href="/create?offer=pdf-100&source=sample-bypass&acquisitionPath=direct_buy" eventName="sample_page_direct_builder_clicked">
              Skip the sample and build it now.
            </TrackedLink>
          </p>

          <div className="sample-before-after">
            <div className="sample-before-after-pair">
              <div className="sample-before-after-item">
                <img src={proofAssets.realFamilyPlayPhoto} alt="Original family photo" />
                <span className="sample-before-after-label">Your photo</span>
              </div>
              <span className="sample-before-after-arrow" aria-hidden="true">&rarr;</span>
              <div className="sample-before-after-item">
                <img src={proofAssets.realFamilyPlayPage} alt="Coloring page result" />
                <span className="sample-before-after-label">Coloring page</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow={founderStoryShort.eyebrow} title={founderStoryShort.title}>
        <article className="surface founder-story founder-story-compact">
          {founderStoryShort.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="founder-signature">{founderStoryShort.signature}</p>
        </article>
      </Section>

      <Section
        eyebrow="Best photo choices"
        title="Better photos in. Better coloring pages out."
        copy="A few examples take the guesswork out of picking the photo to upload."
      >
        <PhotoExampleGrid examples={photoExamples} />
      </Section>

      <Section
        eyebrow="What happens next"
        title="One good sample page makes the full book feel obvious."
        copy="That's the whole point of the free page. You see your own photo in the style first. Then decide whether the rest of the camera roll becomes the book."
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
        title="Questions parents ask before they upload."
        copy="Timing, print versus PDF, multiple kids, gift copies. The details most parents want before they start."
      >
        <FaqAccordion items={faqs} />
      </Section>

      <MarketingFooter />
    </main>
  );
}
