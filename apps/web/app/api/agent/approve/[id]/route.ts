import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminAgentRequest } from "../../../../../lib/agent-auth";
import {
  isDatabaseConfigured,
  getAgentProposalById,
  updateAgentProposalStatus,
  insertAgentJournalEntry,
} from "@littlecolorbook/db";
import crypto from "node:crypto";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

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

  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Proposal is '${proposal.status}', not 'pending'.` } },
      { status: 409 },
    );
  }

  if (new Date() > proposal.expiresAt) {
    await updateAgentProposalStatus({ id, status: "expired" });
    return NextResponse.json(
      { error: { code: "GONE", message: "Proposal has expired." } },
      { status: 410 },
    );
  }

  const reviewedBy = request.headers.get("x-admin-email") ?? "admin";
  const reviewedAt = new Date();

  await updateAgentProposalStatus({ id, status: "approved", reviewedBy, reviewedAt });

  await insertAgentJournalEntry({
    id: makeId("jrn"),
    kind: "system_note",
    relatedProposalId: id,
    targetEntityType: proposal.targetEntityType,
    targetMetaId: proposal.targetMetaId,
    note: `Proposal ${id} (${proposal.kind}) approved by ${reviewedBy}.`,
    createdBy: reviewedBy,
  });

  const updated = await getAgentProposalById(id);
  return NextResponse.json(updated, { status: 200 });
}
