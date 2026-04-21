import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminAgentRequest } from "../../../../../lib/agent-auth";
import {
  isDatabaseConfigured,
  getAgentProposalById,
  updateAgentProposalStatus,
  insertAgentJournalEntry,
} from "@littlecolorbook/db";
import { generateId } from "@littlecolorbook/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeAdminAgentRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured." } },
      { status: 503 },
    );
  }

  const { id } = await params;
  const proposal = await getAgentProposalById(id);

  if (!proposal) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Proposal ${id} not found.` } },
      { status: 404 },
    );
  }

  if (proposal.status !== "pending" && proposal.status !== "approved") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Proposal is '${proposal.status}', cannot reject.` } },
      { status: 409 },
    );
  }

  const reviewedBy = request.headers.get("x-admin-email") ?? "admin";
  const reviewedAt = new Date();

  let rejectReason: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    rejectReason = typeof body.reason === "string" ? body.reason : undefined;
  } catch {
    // body is optional
  }

  await updateAgentProposalStatus({
    id,
    status: "rejected",
    reviewedBy,
    reviewedAt,
    errorMessage: rejectReason ?? null,
  });

  await insertAgentJournalEntry({
    id: generateId("jrn"),
    kind: "proposal_rejected",
    relatedProposalId: id,
    targetEntityType: proposal.targetEntityType,
    targetMetaId: proposal.targetMetaId,
    note: `Proposal ${id} (${proposal.kind}) rejected by ${reviewedBy}${rejectReason ? `: ${rejectReason}` : ""}.`,
    createdBy: reviewedBy,
  });

  const updated = await getAgentProposalById(id);
  return NextResponse.json(updated, { status: 200 });
}
