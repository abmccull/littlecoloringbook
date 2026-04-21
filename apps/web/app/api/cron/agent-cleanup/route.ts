import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { isDatabaseConfigured, expirePendingAgentProposals } from "@littlecolorbook/db";

// Journal retention is intentionally not enforced here yet; this cron only
// expires stale proposals while agent_journal remains append-only.

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
