import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { isDatabaseConfigured, expirePendingAgentProposals } from "@littlecolorbook/db";

// TODO: prune agent_journal rows older than 180 days once volume warrants it.
// The query would be:
//   DELETE FROM agent_journal WHERE created_at < NOW() - INTERVAL '180 days'
// Skip for now — journal is append-only and row counts are low in Phase 4.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const expiredProposals = await expirePendingAgentProposals();

  return NextResponse.json({ expired_proposals: expiredProposals }, { status: 200 });
}
