import { listAgentProposals } from "@littlecolorbook/db";
import type { AgentProposalStatus } from "@littlecolorbook/db";
import { requireAdminSession } from "../../../../lib/auth";
import { ProposalsTable } from "../../../../components/admin/growth-proposals-client";
import type { ProposalRow } from "../../../../components/admin/growth-proposals-client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: AgentProposalStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "executed", label: "Executed" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
];

export default async function GrowthProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const statusFilter = (params.status ?? "pending") as AgentProposalStatus | "all";
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 50;

  const proposals = await listAgentProposals({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: pageSize,
    offset: (pageNum - 1) * pageSize,
  });

  // Cast to the shape expected by the client component
  const rows: ProposalRow[] = proposals.map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status as ProposalRow["status"],
    targetEntityType: p.targetEntityType,
    targetMetaId: p.targetMetaId,
    createdBy: p.createdBy,
    autoApproved: p.autoApproved,
    approvalRequiredReason: p.approvalRequiredReason,
    rationale: p.rationale,
    payloadJson: p.payloadJson,
    createdAt: p.createdAt,
  }));

  function buildQuery(overrides: Record<string, string>) {
    const q = new URLSearchParams({
      status: statusFilter,
      page: String(pageNum),
      ...overrides,
    });
    return `/admin/growth/proposals?${q.toString()}`;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <h1 style={{ margin: 0 }}>Agent proposals</h1>

      {/* Status filter tabs */}
      <nav
        aria-label="Filter proposals by status"
        style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === statusFilter;
          return (
            <a
              key={opt.value}
              href={buildQuery({ status: opt.value, page: "1" })}
              style={{
                padding: "5px 14px",
                borderRadius: "999px",
                fontSize: "0.85rem",
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
        {rows.length} proposal{rows.length !== 1 ? "s" : ""}
        {rows.length === pageSize ? "+" : ""}
        {" "}· Expand a row to see payload, rationale, and actions.
      </p>

      {/* Client component handles expand + approve/reject */}
      <ProposalsTable proposals={rows} adminEmail={session.email ?? ""} />

      {/* Pagination */}
      {(pageNum > 1 || rows.length === pageSize) && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.875rem" }}>
          {pageNum > 1 && (
            <a href={buildQuery({ page: String(pageNum - 1) })}>← Prev</a>
          )}
          <span className="muted">Page {pageNum}</span>
          {rows.length === pageSize && (
            <a href={buildQuery({ page: String(pageNum + 1) })}>Next →</a>
          )}
        </div>
      )}
    </div>
  );
}
