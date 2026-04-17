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
        <h1>Your free page is already on its way!</h1>
        <p className="lede">
          Ready to turn the rest of your photos into the full book?
        </p>

        <div className="hero-actions">
          <Link
            className="button button-primary"
            href="/create?offer=pdf-50&source=sample-limit-reached&acquisitionPath=sample_limit_upsell"
          >
            Build My Family Memory Book
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
