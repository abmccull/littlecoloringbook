import Link from "next/link";
import { SampleStartForm } from "../../components/sample-start-form";
import { TrackPageEvent } from "../../components/track-page-event";

export default function SamplePage() {
  return (
    <main>
      <TrackPageEvent eventName="sample_entry_viewed" />
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>free sample</span>
        </div>
        <Link className="button button-secondary" href="/">
          Back Home
        </Link>
      </header>

      <section className="sample-frame">
        <span className="pill">Free Memory Page</span>
        <h1>Start with one real sample.</h1>
        <p className="lede">
          Cold traffic should not be asked for a full album up front. The sample flow now creates a real sample order first, then moves into a dedicated upload and processing step.
        </p>
        <SampleStartForm />
      </section>
    </main>
  );
}
