import type { GraphClient } from "@littlecolorbook/meta";
import type { MetaCreateResult } from "./types";

type CreateAdCreativeInput = {
  client: GraphClient;
  adAccountId: string;
  name: string;
  pageId: string;
  linkUrl: string;
  message: string;
  imageHash: string;
  cta: string;
  instagramActorId?: string;
};

export async function createAdCreative(input: CreateAdCreativeInput): Promise<MetaCreateResult> {
  const { client, adAccountId, name, pageId, linkUrl, message, imageHash, cta, instagramActorId } = input;

  const linkData: Record<string, unknown> = {
    link: linkUrl,
    message,
    image_hash: imageHash,
    call_to_action: { type: cta, value: { link: linkUrl } },
  };

  const objectStorySpec: Record<string, unknown> = {
    page_id: pageId,
    link_data: linkData,
  };

  if (instagramActorId) {
    objectStorySpec.instagram_actor_id = instagramActorId;
  }

  return client.post<MetaCreateResult>(`act_${adAccountId}/adcreatives`, {
    name,
    object_story_spec: objectStorySpec,
  });
}

type CreateAdCreativeFromPostInput = {
  client: GraphClient;
  adAccountId: string;
  name: string;
  objectStoryId: string;
};

export async function createAdCreativeFromPost(input: CreateAdCreativeFromPostInput): Promise<MetaCreateResult> {
  const { client, adAccountId, name, objectStoryId } = input;
  return client.post<MetaCreateResult>(`act_${adAccountId}/adcreatives`, {
    name,
    object_story_id: objectStoryId,
  });
}
