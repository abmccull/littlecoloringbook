import Link from "next/link";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/broadcasts", label: "Broadcasts" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/metrics/cohorts", label: "Cohorts" },
  { href: "/admin/metrics/attribution", label: "Attribution" },
  { href: "/admin/ads", label: "Ads" },
];

export function AdminNav({ sessionEmail }: { sessionEmail: string | null }) {
  return (
    <nav
      style={{
        display: "flex",
        gap: "16px",
        alignItems: "center",
        padding: "12px 24px",
        borderBottom: "1px solid var(--line)",
        background: "var(--color-paper)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ fontWeight: 600, color: "var(--color-ink)", textDecoration: "none" }}>
        Little Color Book · admin
      </Link>
      <div style={{ display: "flex", gap: "14px", marginLeft: "auto", flexWrap: "wrap" }}>
        {LINKS.map((l) => (
          <Link
            href={l.href}
            key={l.href}
            style={{ color: "var(--color-ink)", textDecoration: "none", fontSize: "0.95rem" }}
          >
            {l.label}
          </Link>
        ))}
        {sessionEmail ? (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {sessionEmail}
          </span>
        ) : null}
        <Link href="/handler/sign-out" style={{ fontSize: "0.85rem", color: "var(--color-ink)" }}>
          Sign out
        </Link>
      </div>
    </nav>
  );
}

export async function AdminTiles() {
  const { listAdminTicketInbox, listAdminRefundQueue, listPrintSubmissionCandidates, listLuluSyncCandidates } =
    await import("@littlecolorbook/db");

  const [tickets, refunds, printCandidates, luluCandidates] = await Promise.all([
    listAdminTicketInbox({ limit: 100 }),
    listAdminRefundQueue(50),
    listPrintSubmissionCandidates(100).catch(() => []),
    listLuluSyncCandidates(100).catch(() => []),
  ]);

  const breaching = tickets.filter(
    (t) => t.firstResponseDueAt && t.firstResponseDueAt.getTime() < Date.now() && !t.firstRespondedAt,
  ).length;

  const tileStyle: React.CSSProperties = {
    padding: "16px 20px",
    background: "var(--color-paper)",
    border: "1px solid var(--line)",
    borderRadius: "12px",
    minWidth: "180px",
    textDecoration: "none",
    color: "inherit",
    display: "grid",
    gap: "4px",
  };

  return (
    <section
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", padding: "20px 24px" }}
    >
      <Link href="/admin/tickets" style={tileStyle}>
        <span className="muted mini-note">Open tickets</span>
        <strong style={{ fontSize: "1.4rem" }}>{tickets.length}</strong>
        {breaching > 0 ? (
          <span style={{ color: "#c85a4a", fontSize: "0.85rem" }}>{breaching} past SLA</span>
        ) : (
          <span className="mini-note">SLA green</span>
        )}
      </Link>
      <Link href="/admin/refunds" style={tileStyle}>
        <span className="muted mini-note">Pending refunds</span>
        <strong style={{ fontSize: "1.4rem" }}>{refunds.length}</strong>
        <span className="mini-note">Requested + approved + processing</span>
      </Link>
      <Link href="/admin" style={tileStyle}>
        <span className="muted mini-note">Awaiting print submission</span>
        <strong style={{ fontSize: "1.4rem" }}>{printCandidates.length}</strong>
        <span className="mini-note">Ready for Lulu</span>
      </Link>
      <Link href="/admin" style={tileStyle}>
        <span className="muted mini-note">In production (Lulu)</span>
        <strong style={{ fontSize: "1.4rem" }}>{luluCandidates.length}</strong>
        <span className="mini-note">Syncing via cron</span>
      </Link>
      <Link href="/admin/broadcasts" style={tileStyle}>
        <span className="muted mini-note">Broadcasts</span>
        <strong style={{ fontSize: "1.4rem" }}>→</strong>
        <span className="mini-note">Preview + approve</span>
      </Link>
    </section>
  );
}
