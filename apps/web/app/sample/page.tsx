import Link from "next/link";
import { BrandLogo } from "../../components/brand-logo";
import { FaqAccordion } from "../../components/faq-accordion";
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

export default async function SamplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const acquisition = getAcquisitionPayloadFromRecord(await searchParams, "sample_first", "sample-page");

  return (
    <main>
      <TrackPageEvent eventName="sample_entry_viewed" />
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/">
          Home
        </Link>
      </header>

      <section className="sample-frame sample-entry">
        <div className="sample-entry-copy">
          <span className="pill pill-sun">Free sample</span>
          <h1>Turn one photo they already love into a free coloring page.</h1>
          <p className="lede">
            Start with one favorite photo first. If the page feels like them, you can turn the rest of your camera roll into the full book right after that.
          </p>
          <ul className="feature-list">
            <li>One free sample page from one favorite photo</li>
            <li>Best for a child portrait, a sibling moment, or a favorite pet</li>
            <li>If your child loves it, you are one step away from the full book.</li>
          </ul>
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
        title="The free page has one job: make the full book feel easy to picture."
        copy="This is the low-risk first look. If the sample feels right, the rest of the decision becomes much easier."
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
        eyebrow="What you are moving toward"
        title="If the sample clicks, choose the book that fits your photo stack."
        copy="30 is the light starter. 50 feels fuller. 100 is the best-value keepsake when the camera roll is packed."
      >
        <div id="sample-page-proof-module">
          <BookMockupBlock
            coverSrc={proofAssets.kidPhoto}
            pageSrc={proofAssets.kidPage}
            title="Print tonight or make it giftable."
            copy="The same pages can become a quick PDF for tonight or a spiral-bound keepsake for birthdays, grandma gifts, and family shelf moments."
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
        eyebrow="FAQ"
        title="Questions moms and grandparents usually ask before they start."
        copy="Timing, print versus PDF, multiple kids, gift copies, and the practical details most people want before they upload."
      >
        <FaqAccordion items={faqs} />
      </Section>
    </main>
  );
}
