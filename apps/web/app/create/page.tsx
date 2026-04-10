import Link from "next/link";
import { CreateOrderForm } from "../../components/create-order-form";
import { BookMockupBlock } from "../../components/proof-modules";
import { TrackPageEvent } from "../../components/track-page-event";
import { proofAssets } from "../../lib/consumer-content";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string }>;
}) {
  const { offer } = await searchParams;

  return (
    <main>
      <TrackPageEvent eventName="builder_viewed" eventProperties={{ initialOffer: offer ?? "pdf-30" }} />
      <header className="topbar">
        <div className="wordmark">
          littlecolorbook.com
          <span>build your book</span>
        </div>
        <Link className="button button-secondary" href="/sample">
          Start with the Free Sample
        </Link>
      </header>

      <section className="builder-layout">
        <CreateOrderForm initialOffer={offer} />
        <aside className="builder-support-grid">
          <div className="surface builder-support-copy">
            <span className="pill pill-coral">Built for fuller camera rolls</span>
            <h2>50 and 100 pages are where the value gets better.</h2>
            <p className="lede">Use 30 only when you want a lighter first version. If you already have a real stack of favorites, the bigger books pay off faster.</p>
            <div className="builder-support-list">
              <article className="builder-support-item">
                <span className="pill pill-mint">50 pages</span>
                <strong>The best mix of price and payoff.</strong>
                <p className="muted">Big enough to feel like a real gift and usually the easiest upsell when the customer has a fuller camera roll.</p>
              </article>
              <article className="builder-support-item">
                <span className="pill pill-sun">100 pages</span>
                <strong>The strongest per-page value.</strong>
                <p className="muted">Best when the album is already packed with trips, birthdays, pets, siblings, and the photos are there anyway.</p>
              </article>
              <article className="builder-support-item">
                <span className="pill pill-sky">30 pages</span>
                <strong>Keep this for the lighter entry point.</strong>
                <p className="muted">It still works, but it should feel like the smaller option, not the obvious default if the customer already has plenty of photos.</p>
              </article>
            </div>
          </div>
          <div className="surface builder-support-proof">
            <BookMockupBlock
              badge="Choose the value tier"
              coverSrc={proofAssets.kidPhoto}
              pageSrc={proofAssets.kidPage}
              title="Pick the size by how full the memory stack feels"
              copy="30 keeps it lighter. 50 feels complete. 100 is the full keepsake version for packed albums, sibling stories, and gift-heavy families."
            />
          </div>
        </aside>
      </section>
    </main>
  );
}
