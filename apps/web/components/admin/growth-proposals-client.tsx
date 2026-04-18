"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalStatus = "pending" | "approved" | "rejected" | "executed" | "failed" | "expired";

export type ProposalRow = {
  id: string;
  kind: string;
  status: ProposalStatus;
  targetEntityType: string | null;
  targetMetaId: string | null;
  createdBy: string;
  autoApproved: boolean;
  approvalRequiredReason: string | null;
  rationale: string | null;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
};

// ─── Pill helpers ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    pending:  { bg: "#FFD65A40", color: "#7D4D3B" },
    approved: { bg: "#DDF4EA", color: "#1E5E45" },
    rejected: { bg: "#c85a4a20", color: "#c85a4a" },
    executed: { bg: "#DDF5FF", color: "#175B77" },
    failed:   { bg: "#c85a4a20", color: "#c85a4a" },
    expired:  { bg: "#F4E7DA", color: "#7D4D3B" },
  };
  const c = colors[status] ?? { bg: "#F4E7DA", color: "#7D4D3B" };
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
      }}
    >
      {status}
    </span>
  );
}

// ─── Approve / Reject button pair ─────────────────────────────────────────────

function ApproveRejectButtons({ proposalId, adminEmail }: { proposalId: string; adminEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    setMessage(null);
    try {
      const endpoint = action === "approve"
        ? `/api/agent/approve/${proposalId}`
        : `/api/agent/reject/${proposalId}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": adminEmail,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        setMessage(`Error: ${res.status} — ${text.slice(0, 120)}`);
        return;
      }
      setMessage(action === "approve" ? "Approved." : "Rejected.");
      router.refresh();
    } catch (err) {
      setMessage(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={loading !== null}
        aria-label="Approve proposal"
        style={{
          padding: "4px 14px",
          borderRadius: "6px",
          background: "#DDF4EA",
          color: "#1E5E45",
          border: "1px solid #72C8A0",
          cursor: loading ? "wait" : "pointer",
          fontWeight: 600,
          fontSize: "0.8rem",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading === "approve" ? "Approving…" : "Approve"}
      </button>
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={loading !== null}
        aria-label="Reject proposal"
        style={{
          padding: "4px 14px",
          borderRadius: "6px",
          background: "#c85a4a20",
          color: "#c85a4a",
          border: "1px solid #c85a4a60",
          cursor: loading ? "wait" : "pointer",
          fontWeight: 600,
          fontSize: "0.8rem",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {message && (
        <span style={{ fontSize: "0.8rem", color: "#7D4D3B" }}>{message}</span>
      )}
    </div>
  );
}

// ─── Expandable payload row ───────────────────────────────────────────────────

function ProposalDetail({ proposal, adminEmail }: { proposal: ProposalRow; adminEmail: string }) {
  const [open, setOpen] = useState(false);

  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
  const createdAtStr = fmt.format(proposal.createdAt instanceof Date ? proposal.createdAt : new Date(proposal.createdAt));

  return (
    <>
      <tr style={{ borderBottom: open ? "none" : "1px solid var(--line)" }}>
        <td style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
          <code style={{ fontSize: "0.8rem", background: "#F4E7DA", padding: "1px 4px", borderRadius: "3px" }}>
            {proposal.kind.replace(/_/g, " ")}
          </code>
        </td>
        <td style={{ padding: "8px 12px", fontSize: "0.82rem", color: "#7D4D3B" }}>
          {proposal.targetEntityType ? (
            <>
              <span>{proposal.targetEntityType}</span>
              {proposal.targetMetaId && (
                <>
                  <br />
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {proposal.targetMetaId.slice(0, 16)}…
                  </span>
                </>
              )}
            </>
          ) : "—"}
        </td>
        <td style={{ padding: "8px 12px", fontSize: "0.82rem" }}>{proposal.createdBy}</td>
        <td style={{ padding: "8px 12px" }}><StatusPill status={proposal.status} /></td>
        <td style={{ padding: "8px 12px" }}>
          {proposal.autoApproved ? (
            <span
              style={{
                display: "inline-block",
                padding: "1px 6px",
                borderRadius: "999px",
                fontSize: "0.7rem",
                fontWeight: 600,
                background: "#DDF5FF",
                color: "#175B77",
              }}
            >
              auto
            </span>
          ) : (
            <span className="muted" style={{ fontSize: "0.75rem" }}>manual</span>
          )}
        </td>
        <td style={{ padding: "8px 12px", fontSize: "0.82rem", color: "#7D4D3B" }}>{createdAtStr}</td>
        <td style={{ padding: "8px 12px" }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              padding: "3px 10px",
              borderRadius: "6px",
              background: "transparent",
              border: "1px solid var(--line)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </td>
      </tr>

      {open && (
        <tr style={{ borderBottom: "1px solid var(--line)", background: "#FFF8F2" }}>
          <td colSpan={7} style={{ padding: "12px 20px" }}>
            <div style={{ display: "grid", gap: "12px" }}>
              {proposal.rationale && (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.85rem" }}>Rationale</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5 }}>{proposal.rationale}</p>
                </div>
              )}

              {proposal.approvalRequiredReason && (
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.85rem" }}>Why approval required</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#7D4D3B" }}>{proposal.approvalRequiredReason}</p>
                </div>
              )}

              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: "0.85rem" }}>Payload</p>
                <pre
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    background: "#241813",
                    color: "#FFF8F2",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    overflowX: "auto",
                    lineHeight: 1.5,
                  }}
                >
                  {JSON.stringify(proposal.payloadJson, null, 2)}
                </pre>
              </div>

              {proposal.status === "pending" && (
                <ApproveRejectButtons proposalId={proposal.id} adminEmail={adminEmail} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Proposals table (client) ─────────────────────────────────────────────────

export function ProposalsTable({
  proposals,
  adminEmail,
}: {
  proposals: ProposalRow[];
  adminEmail: string;
}) {
  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: "0.8rem",
    fontWeight: 600,
    borderBottom: "2px solid var(--line)",
    whiteSpace: "nowrap",
  };

  if (proposals.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          border: "1px solid var(--line)",
          borderRadius: "12px",
        }}
      >
        <p style={{ fontWeight: 700, margin: 0 }}>No proposals</p>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Agent proposals will appear here once the control plane is active.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
        <thead>
          <tr>
            <th style={thStyle}>Kind</th>
            <th style={thStyle}>Target</th>
            <th style={thStyle}>Created by</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Auto</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => (
            <ProposalDetail key={p.id} proposal={p} adminEmail={adminEmail} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
