import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminTicketDetail } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../../lib/auth";
import { AdminTicketActions } from "../../../../components/admin/admin-ticket-actions";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const session = await requireAdminSession();
  const { ticketId } = await params;
  const detail = await getAdminTicketDetail(ticketId);
  if (!detail) notFound();

  const { ticket, messages } = detail;

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <p>
        <Link href="/admin/tickets">← inbox</Link>
      </p>
      <h1>{ticket.subject}</h1>
      <p className="muted">
        <span className={`status-pill status-pill-${ticket.status}`}>{ticket.status}</span>
        {" · "}
        {ticket.category.replace(/_/g, " ")}
        {" · "}
        <strong>{ticket.customerEmail}</strong>
        {ticket.orderId ? (
          <>
            {" · "}
            <Link href={`/admin?orderId=${ticket.orderId}`}>View order</Link>
          </>
        ) : null}
      </p>
      <p className="mini-note">
        Opened {formatDateTime(ticket.createdAt)} · SLA due{" "}
        {ticket.firstResponseDueAt ? formatDateTime(ticket.firstResponseDueAt) : "n/a"} ·{" "}
        {ticket.firstRespondedAt ? `first response ${formatDateTime(ticket.firstRespondedAt)}` : "awaiting first response"}
      </p>

      <div className="stack" style={{ marginTop: "20px" }}>
        {messages.map((m) => {
          const bgColor = m.internal
            ? "#fff3c2"
            : m.author === "admin"
              ? "#fff5e4"
              : "#f8f1e6";
          return (
            <div className="surface" key={m.id} style={{ background: bgColor }}>
              <p className="mini-note">
                <strong>
                  {m.internal
                    ? "INTERNAL NOTE"
                    : m.author === "admin"
                      ? (m.authorEmail ?? "admin")
                      : m.authorEmail ?? "customer"}
                </strong>{" "}
                · {formatDateTime(m.createdAt)}
              </p>
              <p style={{ whiteSpace: "pre-wrap", marginTop: "6px" }}>{m.body}</p>
            </div>
          );
        })}
      </div>

      <AdminTicketActions
        ticketId={ticket.id}
        currentStatus={ticket.status}
        adminEmail={session.email ?? null}
      />
    </main>
  );
}
