import type { GraphClient } from "@littlecolorbook/meta";
import type { AdObjective, AdStatus, MetaCreateResult } from "./types";

type CreateCampaignInput = {
  client: GraphClient;
  adAccountId: string;
  name: string;
  objective: AdObjective;
  status?: AdStatus;
  specialAdCategories?: string[];
};

export async function createCampaign(input: CreateCampaignInput): Promise<MetaCreateResult> {
  const { client, adAccountId, name, objective, status = "PAUSED", specialAdCategories = [] } = input;
  return client.post<MetaCreateResult>(`act_${adAccountId}/campaigns`, {
    name,
    objective,
    status,
    special_ad_categories: specialAdCategories,
  });
}

type UpdateCampaignPatch = {
  name?: string;
  status?: AdStatus;
  daily_budget?: number;
  lifetime_budget?: number;
};

type UpdateCampaignInput = {
  client: GraphClient;
  campaignId: string;
  patch: UpdateCampaignPatch;
};

export async function updateCampaign(input: UpdateCampaignInput): Promise<{ success: boolean }> {
  const { client, campaignId, patch } = input;
  return client.post<{ success: boolean }>(campaignId, patch as Record<string, unknown>);
}

export async function pauseCampaign(input: { client: GraphClient; campaignId: string }): Promise<{ success: boolean }> {
  return updateCampaign({ client: input.client, campaignId: input.campaignId, patch: { status: "PAUSED" } });
}

type GetCampaignInput = {
  client: GraphClient;
  campaignId: string;
  fields?: string[];
};

export async function getCampaign(input: GetCampaignInput): Promise<Record<string, unknown>> {
  const { client, campaignId, fields = ["id", "name", "objective", "status", "special_ad_categories"] } = input;
  return client.get<Record<string, unknown>>(campaignId, { fields: fields.join(",") });
}
