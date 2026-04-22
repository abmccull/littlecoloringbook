import Link from "next/link";
import { getOrderPortalSummaryByOrderId } from "@littlecolorbook/db";
import { BrandLogo } from "../../components/brand-logo";
import { CreateOrderForm } from "../../components/create-order-form";
import { BookMockupBlock } from "../../components/proof-modules";
import { TrackBuyerJourneyStage } from "../../components/track-buyer-journey-stage";
import { TrackPageEvent } from "../../components/track-page-event";
import { getAcquisitionPayloadFromRecord } from "../../lib/acquisition";
import { offerBonuses, proofAssets } from "../../lib/consumer-content";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { email, offer, source, sampleOrderId, childFirstName } = params;
  const acquisition = getAcquisitionPayloadFromRecord(params, "direct_buy", "builder-page");
  const sampleSummary = sampleOrderId ? await getOrderPortalSummaryByOrderId(sampleOrderId) : null;
  const initialEmail = email ?? sampleSummary?.customer?.email ?? undefined;
  const initialChildFirstName = childFirstName ?? sampleSummary?.order.childFirstName ?? undefined;

  return (
    <main>
      <TrackPageEvent eventName="builder_viewed" eventProperties={{ initialOffer: offer ?? "pdf-30", source: source ?? "default" }} />
      <TrackBuyerJourneyStage
        stage="builder_started"
        onceKey="builder-started"
        stageProperties={{
          initialOffer: offer ?? "pdf-30",
          surface: "builder_page",
          source: source ?? "default",
        }}
      />
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="build your book" />
        <Link className="topbar-link" href="/sample">
          Free sample
        </Link>
      </header>

      <section className="builder-layout">
        <CreateOrderForm
          acquisition={acquisition}
          initialChildFirstName={initialChildFirstName}
          initialEmail={initialEmail}
          initialOffer={offer}
        />
        <aside className="builder-support-grid">
          <div className="surface builder-support-copy">
            <span className="pill pill-coral">Built for fuller camera rolls</span>
            <h2>Most families who already have a real stack of favorite photos end up happiest with 50 or 100 pages.</h2>
            <p className="lede">30 is the light starter. If you already know the camera roll is full of good stuff, the bigger books usually feel more worth it.</p>
            <div className="builder-support-list">
              <article className="builder-support-item">
                <span className="pill pill-mint">50 pages</span>
                <strong>The better choice for fuller albums.</strong>
                <p className="muted">Big enough to feel like a real gift without jumping all the way to the largest version.</p>
              </article>
              <article className="builder-support-item">
                <span className="pill pill-sun">100 pages</span>
                <strong>The best-value full keepsake.</strong>
                <p className="muted">Best when the album is already packed with trips, birthdays, pets, siblings, and grandma-worthy moments.</p>
              </article>
              <article className="builder-support-item">
                <span className="pill pill-sky">30 pages</span>
                <strong>The good starter if you want to keep it lighter.</strong>
                <p className="muted">A good fit when you want the smallest full-book option and do not need the extra pages yet.</p>
              </article>
            </div>
          </div>
          <div className="surface builder-support-proof">
            <BookMockupBlock
              badge="Choose the value tier"
              coverSrc={proofAssets.kidPhoto}
              pageSrc={proofAssets.geminiFamilyPage}
              title="Pick the size by how full the memory stack feels."
              copy="30 keeps it lighter. 50 feels fuller. 100 is the best-value keepsake when the camera roll is already packed."
            />
          </div>
          <div className="surface">
            <span className="pill pill-coral">
              Included with every book — ${offerBonuses.reduce((sum, b) => sum + b.value, 0)} in bonuses
            </span>
            <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {offerBonuses.map((bonus) => (
                <li key={bonus.name} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <strong style={{ flex: "0 0 auto" }}>{bonus.name}</strong>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    (${bonus.value} value)
                  </span>
                </li>
              ))}
            </ul>
            <p className="mini-note" style={{ marginTop: 10 }}>
              Bonuses auto-deliver to your order portal the moment checkout clears. No extra cart step.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
