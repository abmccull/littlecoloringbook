import type { GraphClient } from "@littlecolorbook/meta";
import type { AdStatus, BillingEvent, MetaCreateResult, OptimizationGoal, TargetingSpec } from "./types";

type CreateAdSetInput = {
  client: GraphClient;
  adAccountId: string;
  campaignId: string;
  name: string;
  // Meta budget fields are in the account currency's smallest unit (cents for USD).
  dailyBudgetCents: number;
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  targeting: TargetingSpec;
  pixelId?: string;
  status?: AdStatus;
  startTime?: string;
  endTime?: string;
  promotedObject?: Record<string, unknown>;
};

export async function createAdSet(input: CreateAdSetInput): Promise<MetaCreateResult> {
  const {
    client,
    adAccountId,
    campaignId,
    name,
    dailyBudgetCents,
    optimizationGoal,
    billingEvent,
    targeting,
    pixelId,
    status = "PAUSED",
    startTime,
    endTime,
    promotedObject,
  } = input;

  const body: Record<string, unknown> = {
    campaign_id: campaignId,
    name,
    daily_budget: dailyBudgetCents,
    optimization_goal: optimizationGoal,
    billing_event: billingEvent,
    targeting,
    status,
  };

  if (pixelId) body.promoted_object = promotedObject ?? { pixel_id: pixelId, custom_event_type: "PURCHASE" };
  if (promotedObject && !pixelId) body.promoted_object = promotedObject;
  if (startTime) body.start_time = startTime;
  if (endTime) body.end_time = endTime;

  return client.post<MetaCreateResult>(`act_${adAccountId}/adsets`, body);
}

type UpdateAdSetPatch = {
  name?: string;
  status?: AdStatus;
  daily_budget?: number;
  lifetime_budget?: number;
  targeting?: TargetingSpec;
  end_time?: string;
};

type UpdateAdSetInput = {
  client: GraphClient;
  adSetId: string;
  patch: UpdateAdSetPatch;
};

export async function updateAdSet(input: UpdateAdSetInput): Promise<{ success: boolean }> {
  return input.client.post<{ success: boolean }>(input.adSetId, input.patch as Record<string, unknown>);
}

export async function pauseAdSet(input: { client: GraphClient; adSetId: string }): Promise<{ success: boolean }> {
  return updateAdSet({ client: input.client, adSetId: input.adSetId, patch: { status: "PAUSED" } });
}

type GetAdSetInput = {
  client: GraphClient;
  adSetId: string;
  fields?: string[];
};

export async function getAdSet(input: GetAdSetInput): Promise<Record<string, unknown>> {
  const { client, adSetId, fields = ["id", "name", "status", "campaign_id", "daily_budget", "optimization_goal"] } = input;
  return client.get<Record<string, unknown>>(adSetId, { fields: fields.join(",") });
}
