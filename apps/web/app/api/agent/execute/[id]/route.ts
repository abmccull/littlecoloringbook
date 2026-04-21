import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "../../../../../lib/agent-auth";
import {
  isDatabaseConfigured,
  getAgentProposalById,
  updateAgentProposalStatus,
  insertAgentJournalEntry,
  insertAgentBaseline,
  getAdMetricsSummary,
} from "@littlecolorbook/db";
import { executeProposal } from "@littlecolorbook/ads";
import { GraphClient } from "@littlecolorbook/meta";
import { generateId } from "@littlecolorbook/shared";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeAgentRequest(request);
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

  if (proposal.status !== "approved") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Proposal status is '${proposal.status}', must be 'approved' to execute.` } },
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

  const token = process.env.META_SYSTEM_USER_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID ?? "";
  const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v22.0";

  if (!token || !rawAccountId) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Missing META_SYSTEM_USER_TOKEN or META_AD_ACCOUNT_ID." } },
      { status: 503 },
    );
  }

  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId.slice(4) : rawAccountId;
  const client = new GraphClient({ accessToken: token, version: apiVersion, adAccountId });
  const executedAt = new Date();

  try {
    const { result, metricsBaselineNeeded } = await executeProposal(
      {
        kind: proposal.kind,
        payloadJson: proposal.payloadJson,
        targetMetaId: proposal.targetMetaId,
        targetEntityType: proposal.targetEntityType,
      },
      { client, adAccountId, pageId },
    );

    await updateAgentProposalStatus({
      id,
      status: "executed",
      executedAt,
      executionResultJson: result,
    });

    if (metricsBaselineNeeded && proposal.targetMetaId && proposal.targetEntityType) {
      const today = todayString();
      const metrics = await getAdMetricsSummary(proposal.targetMetaId, {
        dateFrom: nDaysAgo(7),
        dateTo: today,
      });

      await insertAgentBaseline({
        id: generateId("bsl"),
        proposalId: id,
        targetMetaId: proposal.targetMetaId,
        targetEntityType: proposal.targetEntityType,
        metricsJson: metrics as unknown as Record<string, unknown>,
      });
    }

    await insertAgentJournalEntry({
      id: generateId("jrn"),
      kind: "proposal_executed",
      relatedProposalId: id,
      targetEntityType: proposal.targetEntityType,
      targetMetaId: proposal.targetMetaId,
      note: `Proposal ${id} (${proposal.kind}) executed successfully.`,
      createdBy: "system",
    });

    const updated = await getAgentProposalById(id);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await updateAgentProposalStatus({ id, status: "failed", errorMessage });

    await insertAgentJournalEntry({
      id: generateId("jrn"),
      kind: "proposal_rejected",
      relatedProposalId: id,
      targetEntityType: proposal.targetEntityType,
      targetMetaId: proposal.targetMetaId,
      note: `Proposal ${id} (${proposal.kind}) execution failed: ${errorMessage}`,
      createdBy: "system",
    });

    return NextResponse.json(
      { error: { code: "EXECUTION_FAILED", message: errorMessage } },
      { status: 502 },
    );
  }
}
