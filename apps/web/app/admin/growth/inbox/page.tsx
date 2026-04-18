import Link from "next/link";
import { listDmThreads, dmPlatformValues, dmThreadStatusValues } from "@littlecolorbook/db";
import type { DmPlatform, DmThreadStatus, DmThread } from "@littlecolorbook/db";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function windowStatus(thread: DmThread): { label: string; color: string } {
  if (!thread.windowExpiresAt) {
    return { label: "no window", color: "#9ca3af" };
  }
  const nowMs = Date.now();
  const expiresMs = thread.windowExpiresAt.getTime();
  if (expiresMs <= nowMs) {
    return { label: "expired", color: "#dc2626" };
  }
  const hoursLeft = Math.max(0, Math.floor((expiresMs - nowMs) / 3_600_000));
  const minsLeft = Math.max(0, Math.floor(((expiresMs - nowMs) % 3_600_000) / 60_000));
  const label = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m left` : `${minsLeft}m left`;
  return { label, color: hoursLeft >= 6 ? "#16a34a" : "#d97706" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: DmPlatform }) {
  const styles: Record<DmPlatform, { bg: string; color: string; label: string }> = {
    fb_messenger: { bg: "#dbeafe", color: "#1d4ed8", label: "FB" },
    ig_direct: { bg: "#fae8ff", color: "#7e22ce", label: "IG" },
  };
  const s = styles[platform];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: DmThreadStatus }) {
  const styles: Record<DmThreadStatus, { bg: string; color: string }> = {
    open: { bg: "#dcfce7", color: "#15803d" },
    snoozed: { bg: "#fef9c3", color: "#a16207" },
    closed: { bg: "#f1f5f9", color: "#64748b" },
  };
  const s = styles[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DmInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const platform = dmPlatformValues.includes(sp.platform as DmPlatform)
    ? (sp.platform as DmPlatform)
    : undefined;
  const status = dmThreadStatusValues.includes(sp.status as DmThreadStatus)
    ? (sp.status as DmThreadStatus)
    : "open";

  const threads = await listDmThreads({
    platform,
    status,
    limit: 50,
    offset: 0,
  });

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ margin: 0 }}>DM Inbox</h1>
        <Link
          href="/admin/growth/inbox/settings"
          style={{
            fontSize: "0.85rem",
            padding: "6px 14px",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            color: "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          Keyword responses
        </Link>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <form
        method="GET"
        style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}
      >
        <select
          name="platform"
          defaultValue={platform ?? ""}
          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.875rem" }}
        >
          <option value="">All platforms</option>
          <option value="fb_messenger">FB Messenger</option>
          <option value="ig_direct">Instagram Direct</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.875rem" }}
        >
          <option value="open">Open</option>
          <option value="snoozed">Snoozed</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="submit"
          style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--line)", cursor: "pointer", fontSize: "0.875rem" }}
        >
          Filter
        </button>
      </form>

      {/* ── Thread table ────────────────────────────────────────────────────── */}
      {threads.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>No DM threads yet.</p>
          <p style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
            Messages sent to the Facebook Page or Instagram account will appear here once the Meta webhook is configured.
          </p>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "12px",
            overflow: "hidden",
            background: "var(--color-paper)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "#f9fafb" }}>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Platform</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>User</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Last message</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Window</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Status</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Unread</th>
                <th style={{ padding: "10px 14px", fontSize: "0.78rem", fontWeight: 600, textAlign: "left" }}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((thread) => {
                const win = windowStatus(thread);
                const userLabel =
                  thread.platformUserHandle ??
                  thread.userDisplayName ??
                  thread.platformUserId;
                return (
                  <tr
                    key={thread.id}
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <PlatformBadge platform={thread.platform} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/admin/growth/inbox/${thread.id}`}
                        style={{ color: "var(--color-ink)", fontWeight: 500, textDecoration: "none", fontSize: "0.875rem" }}
                      >
                        {userLabel.length > 30 ? userLabel.slice(0, 30) + "…" : userLabel}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem", color: "#6b7280", maxWidth: "220px" }}>
                      {formatRelativeTime(thread.lastUserMessageAt)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: win.color }}>{win.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge status={thread.status} />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem" }}>
                      {thread.unreadCount > 0 ? (
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: "22px",
                            padding: "1px 6px",
                            borderRadius: "999px",
                            background: "#ef4444",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textAlign: "center",
                          }}
                        >
                          {thread.unreadCount}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "0.82rem", color: "#6b7280" }}>
                      {thread.assignedTo ?? <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
