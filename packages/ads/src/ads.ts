import type { GraphClient } from "@littlecolorbook/meta";
import type { AdStatus, MetaCreateResult } from "./types";

type CreateAdInput = {
  client: GraphClient;
  adAccountId: string;
  adSetId: string;
  name: string;
  adCreativeId: string;
  status?: AdStatus;
};

export async function createAd(input: CreateAdInput): Promise<MetaCreateResult> {
  const { client, adAccountId, adSetId, name, adCreativeId, status = "PAUSED" } = input;
  return client.post<MetaCreateResult>(`act_${adAccountId}/ads`, {
    adset_id: adSetId,
    name,
    creative: { creative_id: adCreativeId },
    status,
  });
}

type UpdateAdPatch = {
  name?: string;
  status?: AdStatus;
};

type UpdateAdInput = {
  client: GraphClient;
  adId: string;
  patch: UpdateAdPatch;
};

export async function updateAd(input: UpdateAdInput): Promise<{ success: boolean }> {
  return input.client.post<{ success: boolean }>(input.adId, input.patch as Record<string, unknown>);
}

export async function pauseAd(input: { client: GraphClient; adId: string }): Promise<{ success: boolean }> {
  return updateAd({ client: input.client, adId: input.adId, patch: { status: "PAUSED" } });
}

type GetAdInput = {
  client: GraphClient;
  adId: string;
  fields?: string[];
};

export async function getAd(input: GetAdInput): Promise<Record<string, unknown>> {
  const { client, adId, fields = ["id", "name", "status", "adset_id", "creative"] } = input;
  return client.get<Record<string, unknown>>(adId, { fields: fields.join(",") });
}
