import Link from "next/link";
import { listTicketsForCustomer } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function statusCopy(status: string) {
  switch (status) {
    case "open":
      return "We're on it";
    case "awaiting_customer":
      return "Waiting for you";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export default async function AccountTicketsPage() {
  const session = await getCustomerSession();
  if (!session) return null;

  const tickets = await listTicketsForCustomer(session.customerId, 50);

  return (
    <section className="account-section">
      <div className="portal-card">
        <span className="pill">Support</span>
        <h1>Your support tickets.</h1>
        <p className="muted">
          Need help with an order, a page that missed, or a refund question? Open a ticket from any order page or pick
          up a previous conversation below.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="portal-card">
          <p className="muted">No tickets yet. Nothing's broken — keep it that way.</p>
          <Link className="button button-secondary" href="/account/orders">
            Back to orders
          </Link>
        </div>
      ) : (
        <div className="account-order-list">
          {tickets.map((t) => (
            <Link className="account-order-card" href={`/account/tickets/${t.id}`} key={t.id}>
              <div className="account-order-card-head">
                <span className={`status-pill status-pill-${t.status}`}>{statusCopy(t.status)}</span>
                <span className="muted mini-note">{formatDate(t.createdAt)}</span>
              </div>
              <h3>{t.subject}</h3>
              <p className="muted">{t.category.replace(/_/g, " ")}</p>
              {t.summary ? <p className="mini-note">{t.summary.slice(0, 140)}{t.summary.length > 140 ? "…" : ""}</p> : null}
              <p className="account-order-card-cta">Open →</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
