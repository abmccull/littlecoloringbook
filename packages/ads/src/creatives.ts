import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { GraphClient } from "@littlecolorbook/meta";
import type { MetaCreateResult } from "./types";

const GRAPH_API_BASE = "https://graph.facebook.com";

type UploadAdImageInput = {
  client: GraphClient;
  adAccountId: string;
  imagePath: string;
};

type UploadAdImageResult = {
  hash: string;
};

// Multipart image upload to /act_{id}/adimages.
// GraphClient.post() sends JSON; for multipart we bypass it and use raw fetch
// with the same access token that the client holds internally.
// We extract the token via a branded workaround: POST with { source: ... } does
// not match Graph's expected multipart body, so we call the raw endpoint directly.
export async function uploadAdImage(input: UploadAdImageInput): Promise<UploadAdImageResult> {
  const { adAccountId, imagePath } = input;

  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";

  // We use the client's get() method on a dummy path to force token injection —
  // but the cleaner approach is to access the token via the post() body for
  // adimages since the API accepts access_token in FormData for multipart.
  // We POST using native fetch here; the GraphClient already records the API call
  // for JSON requests. For this multipart call we record nothing extra — the
  // GraphClient will record the downstream creative and campaign calls.
  //
  // To get the access token we rely on the fact that GraphClient.get() appends
  // it as a query param. We trigger a no-op get to extract the URL, but that's
  // fragile. Instead we accept that the caller must pass the access token
  // separately — BUT the brief says reuse GraphClient. Compromise: we use the
  // post() method with a special multipart body by intercepting at this layer.
  //
  // Final approach: adimages endpoint accepts access_token in POST form field.
  // We use the client's internal version via a protected property we cannot
  // access. Instead we construct the URL from env (same version the client uses)
  // and pass access_token inline in FormData. The caller passes raw token separately.
  //
  // NOTE: uploadAdImage requires rawAccessToken because GraphClient doesn't
  // expose a multipart upload method. All downstream callers (cron, script) pass
  // the token from env. This is the only place in the package that doesn't go
  // through GraphClient — flagged as a known deviation in the checkpoint report.
  throw new Error(
    "uploadAdImage must be called via uploadAdImageRaw — see creatives.ts for the raw signature.",
  );
}

type UploadAdImageRawInput = {
  accessToken: string;
  version: string;
  adAccountId: string;
  imagePath: string;
};

export async function uploadAdImageRaw(input: UploadAdImageRawInput): Promise<UploadAdImageResult> {
  const { accessToken, version, adAccountId, imagePath } = input;

  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";

  const form = new FormData();
  form.append("access_token", accessToken);
  form.append("filename", new Blob([imageBuffer], { type: mimeType }), filename);

  const url = `${GRAPH_API_BASE}/${version}/act_${adAccountId}/adimages`;
  const response = await fetch(url, { method: "POST", body: form });
  const rawText = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`adimages upload: non-JSON response (status ${response.status}): ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    const err = (parsed as { error?: { message?: string; code?: number } }).error;
    throw new Error(`adimages upload failed (${err?.code ?? response.status}): ${err?.message ?? rawText.slice(0, 200)}`);
  }

  // Meta returns: { images: { [filename]: { hash, url, ... } } }
  const images = (parsed as { images?: Record<string, { hash: string }> }).images ?? {};
  const firstKey = Object.keys(images)[0];
  const hash = firstKey ? images[firstKey]?.hash : undefined;

  if (!hash) {
    throw new Error(`adimages upload: could not extract hash from response: ${rawText.slice(0, 300)}`);
  }

  return { hash };
}

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
