import { z } from "zod";

// ─── Payload schemas — one per proposal kind, all strict ─────────────────────

export const pauseAdPayloadSchema = z
  .object({ adId: z.string().min(1) })
  .strict();

export const scaleBudgetPayloadSchema = z
  .object({
    entity: z.enum(["ad", "adset", "campaign"]),
    entityId: z.string().min(1),
    newDailyBudgetCents: z.number().int().positive(),
  })
  .strict();

export const duplicateToScalingCampaignPayloadSchema = z
  .object({
    adId: z.string().min(1),
    scalingCampaignId: z.string().min(1),
    newDailyBudgetCents: z.number().int().positive(),
  })
  .strict();

export const requestCreativePayloadSchema = z
  .object({ brief: z.string().min(1) })
  .strict();

export const updateTargetingPayloadSchema = z
  .object({
    adSetId: z.string().min(1),
    targetingPatch: z.record(z.string(), z.unknown()),
  })
  .strict();

export const updateAudiencePayloadSchema = z
  .object({
    adSetId: z.string().min(1),
    customAudiences: z.array(z.object({ id: z.string() })).optional(),
    excludedCustomAudiences: z.array(z.object({ id: z.string() })).optional(),
  })
  .strict();

export const reportInsightPayloadSchema = z
  .object({
    observation: z.string().min(1),
    supporting_metrics: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const flagRiskPayloadSchema = z
  .object({
    severity: z.enum(["low", "medium", "high"]),
    observation: z.string().min(1),
    suggested_action: z.string().optional(),
  })
  .strict();

// ─── Discriminated union ──────────────────────────────────────────────────────

export const agentProposalInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pause_ad"), payload: pauseAdPayloadSchema }).strict(),
  z.object({ kind: z.literal("scale_budget"), payload: scaleBudgetPayloadSchema }).strict(),
  z.object({ kind: z.literal("duplicate_to_scaling_campaign"), payload: duplicateToScalingCampaignPayloadSchema }).strict(),
  z.object({ kind: z.literal("request_creative"), payload: requestCreativePayloadSchema }).strict(),
  z.object({ kind: z.literal("update_targeting"), payload: updateTargetingPayloadSchema }).strict(),
  z.object({ kind: z.literal("update_audience"), payload: updateAudiencePayloadSchema }).strict(),
  z.object({ kind: z.literal("report_insight"), payload: reportInsightPayloadSchema }).strict(),
  z.object({ kind: z.literal("flag_risk"), payload: flagRiskPayloadSchema }).strict(),
]);

export type AgentProposalInput = z.infer<typeof agentProposalInputSchema>;
export type AgentProposalKind = AgentProposalInput["kind"];

// ─── Auto-approval matrix ─────────────────────────────────────────────────────
// Rules from plan §5:
// - pause_ad, request_creative, report_insight, flag_risk → always auto-approved
// - scale_budget → auto-approved if newDailyBudgetCents <= 2× current AND <= 3000
// - everything else → requires human approval

const SCALE_BUDGET_AUTO_APPROVE_MAX_CENTS = 3000; // $30/day absolute ceiling

type BudgetLookups = {
  getAdSet: (id: string) => Promise<{ daily_budget?: string } | null>;
  getCampaign: (id: string) => Promise<{ daily_budget?: string } | null>;
};

export async function classifyProposalApproval(
  kind: AgentProposalKind,
  payloadJson: unknown,
  lookups: BudgetLookups,
): Promise<{ autoApproved: boolean; reason: string }> {
  if (
    kind === "pause_ad" ||
    kind === "request_creative" ||
    kind === "report_insight" ||
    kind === "flag_risk"
  ) {
    return { autoApproved: true, reason: `${kind} is always auto-approved` };
  }

  if (kind === "scale_budget") {
    const parsed = scaleBudgetPayloadSchema.safeParse(payloadJson);
    if (!parsed.success) {
      return { autoApproved: false, reason: "scale_budget payload invalid" };
    }

    const { entity, entityId, newDailyBudgetCents } = parsed.data;

    if (entity === "ad") {
      return { autoApproved: false, reason: "ads do not own budgets — requires human review" };
    }

    if (newDailyBudgetCents > SCALE_BUDGET_AUTO_APPROVE_MAX_CENTS) {
      return {
        autoApproved: false,
        reason: `newDailyBudgetCents ${newDailyBudgetCents} exceeds absolute ceiling ${SCALE_BUDGET_AUTO_APPROVE_MAX_CENTS}`,
      };
    }

    let currentBudgetCents: number | null = null;
    if (entity === "adset") {
      const adset = await lookups.getAdSet(entityId);
      if (adset?.daily_budget) {
        currentBudgetCents = parseInt(adset.daily_budget, 10);
      }
    } else if (entity === "campaign") {
      const campaign = await lookups.getCampaign(entityId);
      if (campaign?.daily_budget) {
        currentBudgetCents = parseInt(campaign.daily_budget, 10);
      }
    }

    if (currentBudgetCents === null) {
      return {
        autoApproved: false,
        reason: `could not determine current budget for ${entity} ${entityId} — requires human review`,
      };
    }

    const doubledBudget = currentBudgetCents * 2;
    if (newDailyBudgetCents > doubledBudget) {
      return {
        autoApproved: false,
        reason: `newDailyBudgetCents ${newDailyBudgetCents} exceeds 2× current ${currentBudgetCents} (${doubledBudget})`,
      };
    }

    return { autoApproved: true, reason: `scale_budget within 2× current and ≤$30/day ceiling` };
  }

  // duplicate_to_scaling_campaign, update_targeting, update_audience
  return {
    autoApproved: false,
    reason: `${kind} requires human approval`,
  };
}

// ─── Proposal target extraction ──────────────────────────────────────────────
// Narrow an AgentProposalInput into the optional target_entity_type + target_meta_id
// fields used by the agent_proposals table. Callers previously inlined these
// switch-based casts in apps/web/app/api/agent/propose/route.ts AND
// apps/web/app/api/cron/agent-review/route.ts — which silently defeated the
// discriminated-union typing. This helper narrows off `input.kind` so each
// branch sees the correctly-typed payload without casts.
export type ProposalTarget = {
  entityType: string | null;
  metaId: string | null;
};

export function extractProposalTarget(input: AgentProposalInput): ProposalTarget {
  switch (input.kind) {
    case "pause_ad":
      return { entityType: "ad", metaId: input.payload.adId };
    case "scale_budget":
      return { entityType: input.payload.entity, metaId: input.payload.entityId };
    case "duplicate_to_scaling_campaign":
      return { entityType: "ad", metaId: input.payload.adId };
    case "update_targeting":
    case "update_audience":
      return { entityType: "adset", metaId: input.payload.adSetId };
    case "request_creative":
    case "report_insight":
    case "flag_risk":
      return { entityType: null, metaId: null };
  }
}
