import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "../../../../lib/agent-auth";
import { isDatabaseConfigured, listAgentJournal } from "@littlecolorbook/db";
import type { AgentJournalEntryKind } from "@littlecolorbook/db";

const AGENT_JOURNAL_KINDS: AgentJournalEntryKind[] = [
  "proposal_created",
  "proposal_executed",
  "proposal_rejected",
  "outcome_observed_24h",
  "outcome_observed_72h",
  "risk_flagged",
  "insight_recorded",
  "system_note",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeAgentRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured." } },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);

  const rawKind = searchParams.get("kind");
  const kind = rawKind && (AGENT_JOURNAL_KINDS as string[]).includes(rawKind)
    ? (rawKind as AgentJournalEntryKind)
    : undefined;

  const createdAfterParam = searchParams.get("createdAfter");
  const createdAfter = createdAfterParam ? new Date(createdAfterParam) : undefined;
  if (createdAfter && isNaN(createdAfter.getTime())) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid createdAfter date." } },
      { status: 400 },
    );
  }

  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200);

  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = isNaN(rawOffset) ? 0 : rawOffset;

  const relatedProposalId = searchParams.get("relatedProposalId") ?? undefined;

  const entries = await listAgentJournal({ kind, createdAfter, relatedProposalId, limit, offset });

  return NextResponse.json({ entries, count: entries.length }, { status: 200 });
}
