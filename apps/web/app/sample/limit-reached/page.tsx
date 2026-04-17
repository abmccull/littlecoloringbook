import Link from "next/link";
import { BrandLogo } from "../../../components/brand-logo";

type LimitReachedPageProps = {
  searchParams: Promise<{
    orderId?: string;
  }>;
};

export default async function SampleLimitReachedPage({ searchParams }: LimitReachedPageProps) {
  const { orderId } = await searchParams;

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/sample">
          Home
        </Link>
      </header>

      <section className="sample-frame">
        <span className="pill pill-sun">Free sample</span>
        <h1>You have already created your free coloring page.</h1>
        <p className="lede">
          Each email address gets one free sample page. Yours is already on its way.
        </p>

        <div className="detail-grid">
          {orderId ? (
            <article className="surface detail-card">
              <span className="pill pill-sky">Already have it?</span>
              <p className="muted">
                Check the inbox you used when you started your free sample. Your page link was sent there.
              </p>
            </article>
          ) : null}

          <article className="surface detail-card">
            <span className="pill pill-coral">Ready for more?</span>
            <strong>Turn the rest of your camera roll into the full book.</strong>
            <p className="muted">
              Your free page is proof. If the style felt right, the full book takes the same photos and turns every one into a personalized coloring page your child will actually use.
            </p>
          </article>
        </div>

        <div className="hero-actions">
          <Link
            className="button button-primary"
            href="/create?offer=pdf-100&source=sample-limit-reached&acquisitionPath=sample_limit_upsell"
          >
            Ready for the full book? Get your personalized coloring book
          </Link>
        </div>

        <p className="mini-note">
          Questions or issues? Email us at{" "}
          <a href="mailto:support@littlecolorbook.com">support@littlecolorbook.com</a> and we will sort it out.
        </p>
      </section>
    </main>
  );
}
