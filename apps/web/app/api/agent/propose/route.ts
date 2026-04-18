import { NextRequest, NextResponse } from "next/server";
import { authorizeAgentRequest } from "../../../../lib/agent-auth";
import {
  isDatabaseConfigured,
  insertAgentProposal,
  insertAgentJournalEntry,
} from "@littlecolorbook/db";
import { agentProposalInputSchema, classifyProposalApproval } from "@littlecolorbook/ads";
import { GraphClient } from "@littlecolorbook/meta";
import crypto from "node:crypto";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeAgentRequest(request);
  if (unauthorized) return unauthorized;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Database not configured." } },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = agentProposalInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid proposal input.", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const { kind, payload } = parsed.data;
  const createdBy = request.headers.get("x-agent-id") ?? "agent";

  // Build budget lookups for classifyProposalApproval
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION ?? "v22.0";
  const adAccountId = rawAccountId?.startsWith("act_") ? rawAccountId.slice(4) : (rawAccountId ?? "");

  const client = token
    ? new GraphClient({ accessToken: token, version: apiVersion, adAccountId })
    : null;

  const { getAdSet: adsGetAdSet, getCampaign: adsGetCampaign } = await import("@littlecolorbook/ads");

  const lookups = {
    getAdSet: async (id: string): Promise<{ daily_budget?: string } | null> => {
      if (!client) return null;
      try {
        const result = await adsGetAdSet({ client, adSetId: id, fields: ["daily_budget"] });
        return result as { daily_budget?: string };
      } catch {
        return null;
      }
    },
    getCampaign: async (id: string): Promise<{ daily_budget?: string } | null> => {
      if (!client) return null;
      try {
        const result = await adsGetCampaign({ client, campaignId: id, fields: ["daily_budget"] });
        return result as { daily_budget?: string };
      } catch {
        return null;
      }
    },
  };

  const { autoApproved, reason } = await classifyProposalApproval(
    kind,
    payload,
    lookups,
  );

  // Determine targetEntityType and targetMetaId from payload where obvious
  let targetEntityType: string | null = null;
  let targetMetaId: string | null = null;

  if (kind === "pause_ad") {
    targetEntityType = "ad";
    targetMetaId = (payload as { adId?: string }).adId ?? null;
  } else if (kind === "scale_budget") {
    const p = payload as { entity?: string; entityId?: string };
    targetEntityType = p.entity ?? null;
    targetMetaId = p.entityId ?? null;
  } else if (kind === "duplicate_to_scaling_campaign") {
    targetEntityType = "ad";
    targetMetaId = (payload as { adId?: string }).adId ?? null;
  } else if (kind === "update_targeting" || kind === "update_audience") {
    targetEntityType = "adset";
    targetMetaId = (payload as { adSetId?: string }).adSetId ?? null;
  }

  const proposalId = makeId("prop");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const rationale =
    request.headers.get("x-rationale") ??
    (typeof (body as Record<string, unknown>).rationale === "string"
      ? String((body as Record<string, unknown>).rationale)
      : null);

  const proposal = await insertAgentProposal({
    id: proposalId,
    kind,
    payloadJson: payload as Record<string, unknown>,
    rationale,
    targetEntityType,
    targetMetaId,
    autoApproved,
    approvalRequiredReason: autoApproved ? null : reason,
    createdBy,
    expiresAt,
  });

  if (!proposal) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to insert proposal." } },
      { status: 500 },
    );
  }

  await insertAgentJournalEntry({
    id: makeId("jrn"),
    kind: "proposal_created",
    relatedProposalId: proposal.id,
    targetEntityType,
    targetMetaId,
    note: `Proposal ${proposal.id} (${kind}) created${autoApproved ? " — auto-approved" : ` — requires approval: ${reason}`}`,
    createdBy,
  });

  return NextResponse.json(proposal, { status: 201 });
}
