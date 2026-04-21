// Scheduled agent review. Wakes up once a day, pulls the current
// context snapshot, hands it to the Claude-powered brief-agent, and
// submits each validated proposal through the same path
// /api/agent/propose uses (insertAgentProposal + classifyProposalApproval).
//
// Runs daily via vercel.json. Also manually triggerable with:
//   curl -X POST -H "Authorization: Bearer <CRON_SECRET>" \
//     https://www.littlecolorbook.com/api/cron/agent-review
//
// This endpoint is intentionally thin — all the interesting logic
// lives in /api/agent/context (snapshot builder) and the agent module
// at packages/ads/src/agent. We just glue them together here.

import { NextRequest, NextResponse } from "next/server";

import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { getAppUrl } from "../../../../lib/stripe";
import {
  insertAgentProposal,
  insertAgentJournalEntry,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { agent, classifyProposalApproval, extractProposalTarget } from "@littlecolorbook/ads";
import { EXPIRY_24H_MS, generateId } from "@littlecolorbook/shared";
import { isAnthropicConfigured } from "@littlecolorbook/shared/env";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured — agent cannot run" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const createdBy = "agent:brief-agent";

  // 1. Fetch the current context snapshot from the existing endpoint.
  // Keeping this as an HTTP hop (instead of duplicating the 461-line
  // builder) means any future change to /api/agent/context automatically
  // flows through to what the agent sees.
  const contextUrl = new URL("/api/agent/context", getAppUrl()).toString();
  const agentAuth = process.env.AGENT_AUTH_TOKEN;
  const contextRes = await fetch(contextUrl, {
    method: "GET",
    headers: agentAuth ? { Authorization: `Bearer ${agentAuth}` } : {},
    cache: "no-store",
  });
  if (!contextRes.ok) {
    const body = await contextRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to fetch /api/agent/context: ${contextRes.status}`, body: body.slice(0, 500) },
      { status: 502 },
    );
  }
  const context = await contextRes.json();

  // 2. Run the agent.
  const result = await agent.runBriefAgent(context);

  // 3. For each validated proposal, classify approval state and insert
  // into agent_proposals. Same code path /api/agent/propose uses.
  const submitted: Array<{ proposalId: string; kind: string; autoApproved: boolean }> = [];
  const insertErrors: Array<{ kind: string; error: string }> = [];

  // Meta budget lookups for classifyProposalApproval. If META creds
  // aren't present, we fall through with null lookups — larger-scale
  // budget proposals will just route to human approval by default.
  const lookups = {
    getAdSet: async () => null,
    getCampaign: async () => null,
  };

  for (const proposalInput of result.proposals) {
    const { kind, payload } = proposalInput;
    try {
      const { autoApproved, reason } = await classifyProposalApproval(kind, payload, lookups);
      const proposalId = generateId("prop");
      const expiresAt = new Date(Date.now() + EXPIRY_24H_MS);
      const { entityType: targetEntityType, metaId: targetMetaId } = extractProposalTarget(proposalInput);

      const proposal = await insertAgentProposal({
        id: proposalId,
        kind,
        payloadJson: payload as Record<string, unknown>,
        rationale: null,
        targetEntityType,
        targetMetaId,
        autoApproved,
        approvalRequiredReason: autoApproved ? null : reason,
        createdBy,
        expiresAt,
      });

      if (proposal) {
        submitted.push({ proposalId: proposal.id, kind, autoApproved });
        await insertAgentJournalEntry({
          id: generateId("jrn"),
          kind: "proposal_created",
          relatedProposalId: proposal.id,
          targetEntityType,
          targetMetaId,
          note: `Agent review proposed ${kind}${autoApproved ? " — auto-approved" : ` — requires approval: ${reason}`}`,
          createdBy,
        });
      }
    } catch (error) {
      insertErrors.push({
        kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4. Record an agent-review journal entry so the human can see what ran.
  await insertAgentJournalEntry({
    id: generateId("jrn"),
    kind: "proposal_created",
    relatedProposalId: null,
    targetEntityType: null,
    targetMetaId: null,
    note: `Brief agent review completed: ${result.proposals.length} proposals submitted, ${result.rejected.length} rejected. Cache ${result.usage.cacheHit ? "HIT" : "miss"} (${result.usage.cacheReadInputTokens}/${result.usage.inputTokens + result.usage.cacheReadInputTokens + result.usage.cacheCreationInputTokens} tokens read from cache). ${result.preamble ? "Preamble: " + result.preamble.slice(0, 200) : ""}`,
    createdBy,
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    proposals: result.proposals.length,
    rejected: result.rejected,
    submitted,
    insertErrors,
    usage: result.usage,
    stopReason: result.stopReason,
    preamble: result.preamble,
  });
}

