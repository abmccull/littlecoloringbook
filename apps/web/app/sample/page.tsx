import Link from "next/link";
import { FaqAccordion } from "../../components/faq-accordion";
import { SampleStartForm } from "../../components/sample-start-form";
import { BookMockupBlock, PhotoExampleGrid } from "../../components/proof-modules";
import { Section } from "../../components/section";
import { TrackPageEvent } from "../../components/track-page-event";
import { faqs, photoExamples, proofAssets } from "../../lib/consumer-content";

const sampleReasons = [
  "You only need one good photo to know whether the style feels like your family.",
  "The sample gives you proof before you ever commit to a full book.",
  "If the sample feels right, you can turn the rest of your favorite photos into the full book next.",
];

export default function SamplePage() {
  return (
    <main>
      <TrackPageEvent eventName="sample_entry_viewed" />
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>free sample page</span>
        </div>
        <Link className="button button-secondary" href="/">
          Back Home
        </Link>
      </header>

      <section className="sample-frame sample-entry">
        <div className="sample-entry-copy">
          <span className="pill pill-sun">Free sample</span>
          <h1>Turn one favorite photo into a free coloring page before you buy the full book.</h1>
          <p className="lede">
            Start with one photo your child already loves. We&apos;ll turn it into a printable sample so you can see the style before deciding on the full book.
          </p>
          <ul className="feature-list">
            <li>One free sample page from one favorite photo</li>
            <li>Best for a child portrait, one sibling moment, or a favorite pet</li>
            <li>If your child loves the sample, turn the rest of your photos into a full book.</li>
          </ul>
        </div>
        <div className="surface sample-form-card">
          <span className="pill pill-coral">Start here</span>
          <h3>Tell us where to send it.</h3>
          <p className="muted">You&apos;ll upload the photo on the next screen. This first step just keeps your free page connected to the right inbox.</p>
          <SampleStartForm />
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
        title="The free page has one job: help you decide quickly."
        copy="This is the low-risk proof step. If the page feels right, the full book becomes an easy decision."
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
        title="If the sample clicks, pick the book size that fits your memory stack."
        copy="Keep it simple: 30 pages is the good starter book, 50 pages is the better step up, and 100 pages is the best-value full keepsake."
      >
        <BookMockupBlock
          coverSrc={proofAssets.kidPhoto}
          pageSrc={proofAssets.kidPage}
          title="Print Tonight PDF or Giftable Spiral Book"
          copy="The same pages can become a quick PDF for tonight or a spiral-bound keepsake for birthdays, grandma gifts, and family shelf moments."
        />
      </Section>

      <Section
        eyebrow="FAQ"
        title="Questions moms and grandparents usually ask before they upload."
        copy="Timing, print versus PDF, multiple kids, gift copies, and the rest of the details people want before they start."
      >
        <FaqAccordion items={faqs} />
      </Section>
    </main>
  );
}
