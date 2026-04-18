import Link from "next/link";
import { listRecentBroadcasts } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export default async function AdminBroadcastsPage() {
  await requireAdminSession();
  const broadcasts = await listRecentBroadcasts(50);

  return (
    <main className="admin-main" style={{ padding: "24px" }}>
      <h1>Scheduled broadcasts</h1>
      <p className="muted">
        Newsletter curator drafts land here 24h before their scheduled send. Approve within that window or cancel if
        anything looks wrong.
      </p>

      {broadcasts.length === 0 ? (
        <p className="muted">No broadcasts yet. The curator runs Sunday 14:00 UTC and Thursday 13:00 UTC.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: "8px 12px" }}>Archetype</th>
              <th style={{ padding: "8px 12px" }}>Status</th>
              <th style={{ padding: "8px 12px" }}>Subject</th>
              <th style={{ padding: "8px 12px" }}>Scheduled</th>
              <th style={{ padding: "8px 12px" }}>Created</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "8px 12px" }}>{b.archetype.replace(/_/g, " ")}</td>
                <td style={{ padding: "8px 12px" }}>
                  <span className={`status-pill status-pill-${b.status}`}>{b.status}</span>
                </td>
                <td style={{ padding: "8px 12px", fontSize: "0.9rem" }}>{b.subject ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}>{formatDateTime(b.scheduledFor)}</td>
                <td style={{ padding: "8px 12px" }}>{formatDateTime(b.createdAt)}</td>
                <td style={{ padding: "8px 12px" }}>
                  <Link href={`/admin/broadcasts/${b.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
