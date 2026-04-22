import Link from "next/link";
import { AdminNav } from "./admin-nav-client";

export { AdminNav };

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
    (ticket) => ticket.firstResponseDueAt && ticket.firstResponseDueAt.getTime() < Date.now() && !ticket.firstRespondedAt,
  ).length;

  const tiles = [
    {
      href: "/admin/tickets",
      label: "Open tickets",
      value: String(tickets.length),
      sublabel: breaching > 0 ? `${breaching} past SLA` : "SLA healthy",
      tone: breaching > 0 ? "warn" : "default",
    },
    {
      href: "/admin/refunds",
      label: "Pending refunds",
      value: String(refunds.length),
      sublabel: "Requested, approved, and processing",
      tone: refunds.length > 0 ? "warn" : "default",
    },
    {
      href: "/admin",
      label: "Awaiting print submission",
      value: String(printCandidates.length),
      sublabel: "Ready for Lulu handoff",
      tone: printCandidates.length > 0 ? "warn" : "default",
    },
    {
      href: "/admin",
      label: "In production",
      value: String(luluCandidates.length),
      sublabel: "Lulu sync in progress",
      tone: "good" as const,
    },
    {
      href: "/admin/broadcasts",
      label: "Broadcast reviews",
      value: "Review",
      sublabel: "Approve or cancel queued sends",
      tone: "default" as const,
    },
  ];

  return (
    <section className="admin-tiles-grid">
      {tiles.map((tile) => (
        <Link className={`admin-tile admin-tile-${tile.tone}`} href={tile.href} key={tile.label}>
          <span className="admin-tile-label">{tile.label}</span>
          <strong className="admin-tile-value">{tile.value}</strong>
          <span className="admin-tile-sublabel">{tile.sublabel}</span>
        </Link>
      ))}
    </section>
  );
}
