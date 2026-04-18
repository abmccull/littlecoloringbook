import Link from "next/link";
import { listAdminTicketInbox } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function slaBadge(dueAt: Date | null, respondedAt: Date | null) {
  if (respondedAt) return { label: "responded", color: "#8f7a68" };
  if (!dueAt) return { label: "—", color: "#8f7a68" };
  const diffHours = (dueAt.getTime() - Date.now()) / (60 * 60 * 1000);
  if (diffHours < 0) return { label: `${Math.round(-diffHours)}h past SLA`, color: "#c85a4a" };
  if (diffHours < 8) return { label: `${Math.round(diffHours)}h to SLA`, color: "#d28a3b" };
  return { label: `${Math.round(diffHours)}h to SLA`, color: "#4a9b8f" };
}

export default async function AdminTicketsPage() {
  await requireAdminSession();
  const inbox = await listAdminTicketInbox({ limit: 100 });

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <h1>Support inbox</h1>
      <p className="muted">
        {inbox.length} open. Sorted by SLA — most-urgent first. Default first-response target is 24 hours.
      </p>

      {inbox.length === 0 ? (
        <p className="muted">Clean inbox. Nice.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: "8px 12px" }}>Status</th>
              <th style={{ padding: "8px 12px" }}>SLA</th>
              <th style={{ padding: "8px 12px" }}>Subject</th>
              <th style={{ padding: "8px 12px" }}>Customer</th>
              <th style={{ padding: "8px 12px" }}>Category</th>
              <th style={{ padding: "8px 12px" }}>Created</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {inbox.map((t) => {
              const sla = slaBadge(t.firstResponseDueAt, t.firstRespondedAt);
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <span className={`status-pill status-pill-${t.status}`}>{t.status}</span>
                  </td>
                  <td style={{ padding: "8px 12px", color: sla.color, fontWeight: 600 }}>{sla.label}</td>
                  <td style={{ padding: "8px 12px", fontSize: "0.9rem" }}>
                    <Link href={`/admin/tickets/${t.id}`}>{t.subject}</Link>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{t.customerEmail}</td>
                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{t.category.replace(/_/g, " ")}</td>
                  <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>{formatDateTime(t.createdAt)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <Link href={`/admin/tickets/${t.id}`}>Open →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
