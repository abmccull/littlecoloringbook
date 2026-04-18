import Link from "next/link";
import { listAgentJournal } from "@littlecolorbook/db";
import type { AgentJournalEntryKind } from "@littlecolorbook/db";
import { formatDateTime } from "../../../../lib/growth-format";

export const dynamic = "force-dynamic";

const KIND_OPTIONS: Array<{ value: AgentJournalEntryKind | "all"; label: string }> = [
  { value: "all",                    label: "All" },
  { value: "proposal_created",       label: "Proposal created" },
  { value: "proposal_executed",      label: "Proposal executed" },
  { value: "proposal_rejected",      label: "Proposal rejected" },
  { value: "outcome_observed_24h",   label: "Outcome 24h" },
  { value: "outcome_observed_72h",   label: "Outcome 72h" },
  { value: "risk_flagged",           label: "Risk flagged" },
  { value: "insight_recorded",       label: "Insight recorded" },
  { value: "system_note",            label: "System note" },
];

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    proposal_created:       { bg: "#DDF5FF", color: "#175B77" },
    proposal_executed:      { bg: "#DDF4EA", color: "#1E5E45" },
    proposal_rejected:      { bg: "#c85a4a20", color: "#c85a4a" },
    outcome_observed_24h:   { bg: "#FFD65A40", color: "#7D4D3B" },
    outcome_observed_72h:   { bg: "#FFD65A60", color: "#7D4D3B" },
    risk_flagged:           { bg: "#c85a4a20", color: "#c85a4a" },
    insight_recorded:       { bg: "#F4E7DA", color: "#7D4D3B" },
    system_note:            { bg: "#F4E7DA", color: "#7D4D3B" },
  };
  const c = colors[kind] ?? { bg: "#F4E7DA", color: "#7D4D3B" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {kind.replace(/_/g, " ")}
    </span>
  );
}

export default async function GrowthJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const params = await searchParams;
  const kindFilter = (params.kind ?? "all") as AgentJournalEntryKind | "all";
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 50;

  const entries = await listAgentJournal({
    kind: kindFilter === "all" ? undefined : kindFilter,
    limit: pageSize,
    offset: (pageNum - 1) * pageSize,
  });

  function buildQuery(overrides: Record<string, string>) {
    const q = new URLSearchParams({
      kind: kindFilter,
      page: String(pageNum),
      ...overrides,
    });
    return `/admin/growth/journal?${q.toString()}`;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <h1 style={{ margin: 0 }}>Agent journal</h1>

      {/* Kind filter */}
      <nav
        aria-label="Filter journal by kind"
        style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
      >
        {KIND_OPTIONS.map((opt) => {
          const active = opt.value === kindFilter;
          return (
            <a
              key={opt.value}
              href={buildQuery({ kind: opt.value, page: "1" })}
              style={{
                padding: "5px 12px",
                borderRadius: "999px",
                fontSize: "0.82rem",
                fontWeight: active ? 700 : 500,
                textDecoration: "none",
                background: active ? "#241813" : "var(--color-paper)",
                color: active ? "#FFF8F2" : "var(--color-ink)",
                border: "1px solid var(--line)",
              }}
            >
              {opt.label}
            </a>
          );
        })}
      </nav>

      <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
        {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        {entries.length === pageSize ? "+" : ""}
      </p>

      {entries.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            border: "1px solid var(--line)",
            borderRadius: "12px",
          }}
        >
          <p style={{ fontWeight: 700, margin: 0 }}>No journal entries yet</p>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            The agent control plane will write entries here as it processes proposals and observes outcomes.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {entries.map((entry) => (
            <details
              key={entry.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "8px",
                background: "var(--color-paper)",
              }}
            >
              <summary
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  listStyle: "none",
                  userSelect: "none",
                }}
              >
                <KindBadge kind={entry.kind} />
                <span style={{ color: "#7D4D3B", fontSize: "0.82rem", flexShrink: 0 }}>
                  {formatDateTime(entry.createdAt)}
                </span>
                {entry.targetEntityType && (
                  <span style={{ fontSize: "0.82rem", color: "#7D4D3B" }}>
                    {entry.targetEntityType}
                    {entry.targetMetaId && (
                      <> · <code style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{entry.targetMetaId.slice(0, 16)}…</code></>
                    )}
                  </span>
                )}
                {entry.relatedProposalId && (
                  <Link
                    href={`/admin/growth/proposals?status=all`}
                    style={{ fontSize: "0.8rem" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    proposal ↗
                  </Link>
                )}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "0.875rem",
                  }}
                  title={entry.note}
                >
                  {entry.note.slice(0, 100)}{entry.note.length > 100 ? "…" : ""}
                </span>
              </summary>

              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "grid", gap: "10px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>{entry.note}</p>

                {entry.metricsSnapshotJson && (
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.85rem" }}>Metrics snapshot</p>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px 12px",
                        background: "#241813",
                        color: "#FFF8F2",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        overflowX: "auto",
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(entry.metricsSnapshotJson, null, 2)}
                    </pre>
                  </div>
                )}

                {entry.deltaFromBaselineJson && (
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.85rem" }}>Delta from baseline</p>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px 12px",
                        background: "#241813",
                        color: "#FFF8F2",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        overflowX: "auto",
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(entry.deltaFromBaselineJson, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(pageNum > 1 || entries.length === pageSize) && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.875rem" }}>
          {pageNum > 1 && (
            <a href={buildQuery({ page: String(pageNum - 1) })}>← Prev</a>
          )}
          <span className="muted">Page {pageNum}</span>
          {entries.length === pageSize && (
            <a href={buildQuery({ page: String(pageNum + 1) })}>Next →</a>
          )}
        </div>
      )}
    </div>
  );
}
