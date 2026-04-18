import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicketForCustomer } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../lib/auth";
import { TicketReplyForm } from "../../../../components/account/ticket-reply-form";

export const dynamic = "force-dynamic";

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

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function AccountTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const session = await getCustomerSession();
  if (!session) return null;

  const { ticketId } = await params;
  const detail = await getTicketForCustomer({ ticketId, customerId: session.customerId });
  if (!detail) notFound();

  const { ticket, messages } = detail;
  const canReply = ticket.status !== "closed";

  return (
    <section className="account-section">
      <div className="portal-card">
        <p>
          <Link href="/account/tickets">← back to tickets</Link>
        </p>
        <span className={`status-pill status-pill-${ticket.status}`}>{statusCopy(ticket.status)}</span>
        <h1>{ticket.subject}</h1>
        <p className="muted">
          {ticket.category.replace(/_/g, " ")}
          {ticket.orderId ? (
            <>
              {" · "}
              <Link href={`/account/orders/${ticket.orderId}`}>View order</Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="stack">
        {messages.map((m) => (
          <div
            className="surface"
            key={m.id}
            style={{
              background: m.author === "admin" ? "#fff5e4" : "#f8f1e6",
            }}
          >
            <p className="mini-note">
              <strong>{m.author === "admin" ? "Little Color Book team" : "You"}</strong> ·{" "}
              {formatDateTime(m.createdAt)}
            </p>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "8px" }}>{m.body}</p>
          </div>
        ))}
      </div>

      {canReply ? (
        <div className="portal-card">
          <h3>Reply</h3>
          <TicketReplyForm ticketId={ticket.id} />
        </div>
      ) : (
        <div className="portal-card">
          <p className="muted">This ticket is closed. Need to revisit it? Open a new one from your order.</p>
        </div>
      )}
    </section>
  );
}
