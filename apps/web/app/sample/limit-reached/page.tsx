import Link from "next/link";
import { BrandLogo } from "../../../components/brand-logo";

type LimitReachedPageProps = {
  searchParams: Promise<{
    orderId?: string;
    email?: string;
  }>;
};

export default async function SampleLimitReachedPage({ searchParams }: LimitReachedPageProps) {
  const { orderId, email } = await searchParams;

  const buildHref = (() => {
    const params = new URLSearchParams({
      offer: "pdf-50",
      source: "sample-limit-reached",
      acquisitionPath: "sample_limit_upsell",
    });
    if (orderId) params.set("sampleOrderId", orderId);
    if (email) params.set("email", email);
    return `/create?${params.toString()}`;
  })();

  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="free sample page" />
        <Link className="topbar-link" href="/sample">
          Home
        </Link>
      </header>

      <section className="sample-frame">
        <span className="pill pill-sun">You've tried a sample</span>
        <h1>Ready to build the full book?</h1>
        <p className="lede">
          You already used your free sample page. Turn 50 favorite photos into a spiral-bound keepsake your kid will actually color.
        </p>

        <ul className="checklist">
          <li>50 personalized pages from your camera roll</li>
          <li>Print tonight or order the spiral-bound book</li>
          <li>Ships in 3-5 days — birthdays, travel, keepsakes</li>
        </ul>

        <div className="hero-actions">
          <Link className="button button-primary" href={buildHref}>
            Build My Book
          </Link>
        </div>

        <p className="mini-note">
          Need help?{" "}
          <a href="mailto:support@littlecolorbook.com">support@littlecolorbook.com</a>
        </p>
      </section>
    </main>
  );
}
