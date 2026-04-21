import Link from "next/link";
import { BrandLogo } from "../../../components/brand-logo";

type LimitReachedPageProps = {
  searchParams: Promise<{
    orderId?: string;
    email?: string;
    blockedBy?: string;
    ipLimit?: string;
    ipWindowDays?: string;
  }>;
};

export default async function SampleLimitReachedPage({ searchParams }: LimitReachedPageProps) {
  const { orderId, email, blockedBy, ipLimit, ipWindowDays } = await searchParams;
  const blockedReasons = new Set((blockedBy ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const householdLimit = Number.parseInt(ipLimit ?? "", 10);
  const displayHouseholdLimit = Number.isFinite(householdLimit) && householdLimit > 0 ? householdLimit : 4;
  const householdWindowDays = Number.parseInt(ipWindowDays ?? "", 10);
  const displayHouseholdWindowDays =
    Number.isFinite(householdWindowDays) && householdWindowDays > 0 ? householdWindowDays : 30;

  let heading = "Free sample limit reached";
  let lede =
    `To keep bots and fake signups from abusing free generations, we allow 1 sample per email, 1 active sample per browser, and up to ${displayHouseholdLimit} samples per household/network in ${displayHouseholdWindowDays} days.`;

  if (blockedReasons.has("email")) {
    heading = "This email already used a free sample";
    lede =
      "Each email gets 1 free sample. If you want to keep going right now, you can continue into the full book flow below.";
  } else if (blockedReasons.has("visitor")) {
    heading = "This browser already used a free sample";
    lede =
      "We allow 1 active free sample per browser so the sample flow cannot be recycled endlessly from the same device while a sample is still in progress. You can still continue into the full book flow below.";
  } else if (blockedReasons.has("ip")) {
    heading = "This household or network reached the free sample limit";
    lede =
      `We allow up to ${displayHouseholdLimit} free samples per household/network in a ${displayHouseholdWindowDays}-day window. That gives real families room to try it while still blocking automated abuse.`;
  }

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
        <span className="pill pill-sun">Free sample policy</span>
        <h1>{heading}</h1>
        <p className="lede">{lede}</p>

        <div className="status-banner status-banner-warning status-banner-compact">
          <div className="status-banner-copy">
            <strong>The free page is capped so real families can still use it.</strong>
            <p>The full book flow is still open below, and support can review anything that looks wrong for your household.</p>
          </div>
        </div>

        <ul className="checklist">
          <li>50 personalized pages from your camera roll</li>
          <li>Print tonight or order the spiral-bound book</li>
          <li>Ships in 3-5 days - birthdays, travel, keepsakes</li>
        </ul>

        <div className="hero-actions">
          <Link className="button button-primary" href={buildHref}>
            Build My Book
          </Link>
        </div>

        <p className="mini-note">
          If you think this limit is wrong for your household, email{" "}
          <a href="mailto:support@littlecolorbook.com">support@littlecolorbook.com</a>.
        </p>
      </section>
    </main>
  );
}
