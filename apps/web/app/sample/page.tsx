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

const samplePhotoExamples = photoExamples.slice(0, 3);
const sampleFaqs = faqs.slice(0, 4);

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
          <span className="pill pill-sun">Choose the easiest first photo</span>
          <h1>Pick the one image they'd recognize instantly.</h1>
          <p className="lede">
            Clear faces, sibling moments, and favorite pets make the strongest first proof. Claim the free page first, then upload the photo on the next screen.
          </p>
          <div className="sample-entry-support-grid">
            {sampleSupportNotes.map((note) => (
              <article className={`sample-entry-note sample-entry-note-${note.tone}`} key={note.title}>
                <span className="sample-entry-note-badge">{note.badge}</span>
                <strong>{note.title}</strong>
                <p>{note.detail}</p>
              </article>
            ))}
          </div>
          <div className="surface sample-entry-story">
            <span className="pill pill-coral">What this gives you</span>
            <p className="muted">A fast yes-or-no moment. If the sample feels like your family, the full book is already lined up on the next step.</p>
          </div>
        </div>
        <div className="surface sample-form-card">
          <div className="sample-form-card-priority">
            <span className="pill pill-coral">Start here</span>
            <p className="sample-form-hero">One favorite photo. One free proof. Decide after you see it.</p>
            <p className="muted">We only need your email first. The actual photo upload happens on the next screen.</p>
          </div>
          <div className="sample-form-highlights" aria-label="Sample highlights">
            <span>Free first page</span>
            <span>No card required</span>
            <span>Full book next</span>
          </div>
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

      <Section
        eyebrow="Use one of these"
        title="The strongest first page comes from one obvious subject."
        copy="Pick the kind of photo a child would recognize without effort: a close face, a simple sibling moment, or one favorite pet."
      >
        <PhotoExampleGrid examples={samplePhotoExamples} />
      </Section>

      <Section
        eyebrow="What happens next"
        title="The sample is there to answer one question fast."
        copy="Does your own family photo feel worth turning into the full book? That is the only job of this first page."
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
        eyebrow="If it's a yes"
        title="The full book is the same flow, just with more favorite photos."
        copy="Start with 30 if you want the smallest version. Move to 50 when you want the safer full-book choice. Choose 100 when the camera roll is already full of birthdays, pets, trips, and sibling moments."
      >
        <div id="sample-page-proof-module">
          <BookMockupBlock
            badge="Real photo to real keepsake"
            bookMockupSrc={proofAssets.spiralBookClosedSword}
            coverSrc={proofAssets.realSwordPlayPhoto}
            pageSrc={proofAssets.realSwordPlayPage}
            title="Keep it as a quick PDF or turn it into the spiral book worth giving."
            copy="The same personalized pages can print tonight or become the keepsake version for birthdays, grandparents, and family shelves."
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
        <FaqAccordion items={sampleFaqs} />
      </Section>

      <MarketingFooter />
    </main>
  );
}
