import Link from "next/link";
import { BrandLogo } from "../../components/brand-logo";

export const metadata = {
  title: "Refund Policy | Little Color Book",
  description:
    "Our honest refund policy. PDFs: 30 days, no questions. Printed books: state-aware, always generous.",
};

export default function RefundsPolicyPage() {
  return (
    <main>
      <header className="topbar topbar-flow">
        <BrandLogo href="/" subtitle="refunds" />
        <Link className="topbar-link" href="/">
          Home
        </Link>
      </header>

      <section className="portal-card" style={{ maxWidth: "720px", margin: "24px auto" }}>
        <span className="pill">Policy</span>
        <h1>Our honest refund policy.</h1>
        <p className="lede">
          We want you to love your book. If you don't, we make it right. Here's exactly how that works.
        </p>

        <h2>Digital PDFs — 30 days, no questions asked.</h2>
        <p>
          If your child doesn't light up, reply to any order email (or open a ticket from your account) within 30 days
          of delivery. We refund in full. You keep the PDF. No return required.
        </p>

        <h2>Printed spiral books — state-aware, always generous.</h2>
        <p>
          Because every book is custom-printed for you, the remedy depends on how far along your order is:
        </p>
        <ul>
          <li>
            <strong>Before we send it to the printer</strong> (under ~2 hours after checkout, or while your order shows
            "Awaiting print submission") — full refund, no shipping charge, we cancel the job.
          </li>
          <li>
            <strong>Already at the printer but not shipped</strong> — full refund minus the production cost we've
            already paid (about 40% of the print portion). PDF stays yours.
          </li>
          <li>
            <strong>Shipped or delivered, print quality issue</strong> — free replacement at our cost OR full refund,
            your pick. Just send a photo of what's wrong within 30 days of delivery. The first one is yours to keep.
          </li>
          <li>
            <strong>Shipped or delivered, arrived damaged</strong> — free replacement, every time. Photo helps but isn't
            required. Shipping damage isn't your problem.
          </li>
          <li>
            <strong>Changed your mind after it shipped</strong> — we don't take returns on custom printed books, but
            we'll refund the PDF portion on request and can often offer 25% store credit. Ask.
          </li>
        </ul>

        <h2>Perfect Page redo.</h2>
        <p>
          Before you print, any page you don't love gets regenerated free until you do. Use the "Get help with this
          order" button in your account.
        </p>

        <h2>How to start a refund or ask for help.</h2>
        <p>
          Sign into your account → pick the order → click <strong>Get help</strong> or <strong>Request refund</strong>.
          We respond within one business day (most tickets in a few hours). Or email{" "}
          <a href="mailto:support@littlecolorbook.com">support@littlecolorbook.com</a>.
        </p>

        <div className="hero-actions" style={{ marginTop: "32px" }}>
          <Link className="button button-primary" href="/account/orders">
            Go to my orders
          </Link>
          <Link className="button button-secondary" href="/account/tickets">
            View my tickets
          </Link>
        </div>
      </section>
    </main>
  );
}
