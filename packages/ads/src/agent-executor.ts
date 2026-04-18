import type { GraphClient } from "@littlecolorbook/meta";
import { pauseAd, getAd } from "./ads";
import { createAdSet, getAdSet, updateAdSet } from "./adsets";
import { updateCampaign } from "./campaigns";
import { createAdCreativeFromPost } from "./creatives";
import type { AgentProposalKind } from "./agent-proposals";
import {
  pauseAdPayloadSchema,
  scaleBudgetPayloadSchema,
  duplicateToScalingCampaignPayloadSchema,
  requestCreativePayloadSchema,
  updateTargetingPayloadSchema,
  updateAudiencePayloadSchema,
  reportInsightPayloadSchema,
  flagRiskPayloadSchema,
} from "./agent-proposals";

export type ProposalExecutionContext = {
  client: GraphClient;
  adAccountId: string;
  pageId: string;
};

export type ExecuteProposalResult = {
  result: Record<string, unknown>;
  metricsBaselineNeeded: boolean;
};

class ProposalExecutionError extends Error {
  constructor(
    public readonly kind: AgentProposalKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProposalExecutionError";
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeProposal(
  proposal: {
    kind: AgentProposalKind;
    payloadJson: unknown;
    targetMetaId: string | null;
    targetEntityType: string | null;
  },
  ctx: ProposalExecutionContext,
): Promise<ExecuteProposalResult> {
  const { kind, payloadJson } = proposal;

  switch (kind) {
    case "pause_ad": {
      const parsed = pauseAdPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      const adId = proposal.targetMetaId ?? parsed.data.adId;
      try {
        const response = await pauseAd({ client: ctx.client, adId });
        return { result: response as Record<string, unknown>, metricsBaselineNeeded: true };
      } catch (err) {
        throw new ProposalExecutionError(kind, `pauseAd failed for ${adId}: ${String(err)}`, err);
      }
    }

    case "scale_budget": {
      const parsed = scaleBudgetPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      const { entity, entityId, newDailyBudgetCents } = parsed.data;
      if (entity === "ad") {
        throw new ProposalExecutionError(kind, "ads do not own budgets — scale_budget must target adset or campaign");
      }
      try {
        let response: Record<string, unknown>;
        if (entity === "adset") {
          response = (await updateAdSet({
            client: ctx.client,
            adSetId: entityId,
            patch: { daily_budget: newDailyBudgetCents },
          })) as Record<string, unknown>;
        } else {
          response = (await updateCampaign({
            client: ctx.client,
            campaignId: entityId,
            patch: { daily_budget: newDailyBudgetCents },
          })) as Record<string, unknown>;
        }
        return { result: response, metricsBaselineNeeded: true };
      } catch (err) {
        throw new ProposalExecutionError(kind, `scale_budget failed for ${entity} ${entityId}: ${String(err)}`, err);
      }
    }

    case "duplicate_to_scaling_campaign": {
      const parsed = duplicateToScalingCampaignPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      const { adId, scalingCampaignId, newDailyBudgetCents } = parsed.data;
      try {
        // 1. Fetch the source ad to get its adset and creative
        const sourceAd = await getAd({ client: ctx.client, adId, fields: ["id", "name", "adset_id", "creative"] });
        const adSetId = String(sourceAd.adset_id ?? "");
        if (!adSetId) {
          throw new ProposalExecutionError(kind, `source ad ${adId} has no adset_id`);
        }

        // 2. Fetch the source adset for targeting/optimization config
        const sourceAdSet = await getAdSet({
          client: ctx.client,
          adSetId,
          fields: ["id", "name", "optimization_goal", "billing_event", "targeting", "promoted_object"],
        });

        const optimizationGoal = String(sourceAdSet.optimization_goal ?? "OFFSITE_CONVERSIONS") as import("./types").OptimizationGoal;
        const billingEvent = String(sourceAdSet.billing_event ?? "IMPRESSIONS") as import("./types").BillingEvent;
        const targeting = (sourceAdSet.targeting ?? {}) as import("./types").TargetingSpec;

        // 3. Create a new adset under the scaling campaign
        const newAdSet = await createAdSet({
          client: ctx.client,
          adAccountId: ctx.adAccountId,
          campaignId: scalingCampaignId,
          name: `scaled_${Date.now()}_${adId}`,
          dailyBudgetCents: newDailyBudgetCents,
          optimizationGoal,
          billingEvent,
          targeting,
          status: "PAUSED",
        });

        // 4. Create a new ad in the new adset using the same object_story_id
        const creativeInfo = sourceAd.creative as Record<string, unknown> | undefined;
        const objectStoryId = String(creativeInfo?.object_story_id ?? "");
        if (!objectStoryId) {
          throw new ProposalExecutionError(kind, `source ad ${adId} creative has no object_story_id — cannot duplicate via post reference`);
        }

        const newCreative = await createAdCreativeFromPost({
          client: ctx.client,
          adAccountId: ctx.adAccountId,
          name: `scaled_creative_${Date.now()}`,
          objectStoryId,
        });

        const { createAd } = await import("./ads");
        const newAd = await createAd({
          client: ctx.client,
          adAccountId: ctx.adAccountId,
          adSetId: newAdSet.id,
          name: `scaled_ad_${Date.now()}`,
          adCreativeId: newCreative.id,
          status: "PAUSED",
        });

        return {
          result: { newAdSetId: newAdSet.id, newCreativeId: newCreative.id, newAdId: newAd.id },
          metricsBaselineNeeded: true,
        };
      } catch (err) {
        if (err instanceof ProposalExecutionError) throw err;
        throw new ProposalExecutionError(kind, `duplicate_to_scaling_campaign failed: ${String(err)}`, err);
      }
    }

    case "request_creative": {
      const parsed = requestCreativePayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      // Lazy import to avoid bundling DB in tests that don't need it
      const { insertCreativeRequest } = await import("@littlecolorbook/db/repositories");
      const requestId = `creq_${crypto.randomUUID().replace(/-/g, "")}`;
      const row = await insertCreativeRequest({ id: requestId, briefJson: { brief: parsed.data.brief } });
      return {
        result: { creative_request_id: row?.id ?? requestId },
        metricsBaselineNeeded: false,
      };
    }

    case "update_targeting": {
      const parsed = updateTargetingPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      const { adSetId, targetingPatch } = parsed.data;
      try {
        // Fetch current targeting, merge patch
        const current = await getAdSet({
          client: ctx.client,
          adSetId,
          fields: ["id", "targeting"],
        });
        const mergedTargeting = { ...(current.targeting as Record<string, unknown> ?? {}), ...targetingPatch };
        const response = await updateAdSet({
          client: ctx.client,
          adSetId,
          patch: { targeting: mergedTargeting as import("./types").TargetingSpec },
        });
        return { result: response as Record<string, unknown>, metricsBaselineNeeded: true };
      } catch (err) {
        throw new ProposalExecutionError(kind, `update_targeting failed for adset ${adSetId}: ${String(err)}`, err);
      }
    }

    case "update_audience": {
      const parsed = updateAudiencePayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      const { adSetId, customAudiences, excludedCustomAudiences } = parsed.data;
      try {
        const current = await getAdSet({
          client: ctx.client,
          adSetId,
          fields: ["id", "targeting"],
        });
        const currentTargeting = (current.targeting as Record<string, unknown>) ?? {};
        const updatedTargeting: Record<string, unknown> = { ...currentTargeting };
        if (customAudiences !== undefined) updatedTargeting.custom_audiences = customAudiences;
        if (excludedCustomAudiences !== undefined) updatedTargeting.excluded_custom_audiences = excludedCustomAudiences;

        const response = await updateAdSet({
          client: ctx.client,
          adSetId,
          patch: { targeting: updatedTargeting as import("./types").TargetingSpec },
        });
        return { result: response as Record<string, unknown>, metricsBaselineNeeded: true };
      } catch (err) {
        throw new ProposalExecutionError(kind, `update_audience failed for adset ${adSetId}: ${String(err)}`, err);
      }
    }

    case "report_insight": {
      const parsed = reportInsightPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      return { result: parsed.data as Record<string, unknown>, metricsBaselineNeeded: false };
    }

    case "flag_risk": {
      const parsed = flagRiskPayloadSchema.safeParse(payloadJson);
      if (!parsed.success) {
        throw new ProposalExecutionError(kind, `Invalid payload: ${parsed.error.message}`);
      }
      return { result: parsed.data as Record<string, unknown>, metricsBaselineNeeded: false };
    }

    default: {
      const exhaustive: never = kind;
      throw new ProposalExecutionError(exhaustive, `Unknown proposal kind: ${String(exhaustive)}`);
    }
  }
}
