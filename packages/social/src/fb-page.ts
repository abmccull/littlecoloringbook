import { readFile } from "node:fs/promises";
import { FbPublishError, type FbCarouselPublishInput, type FbPhotoPublishResult, type FbPublishPhotoInput } from "./types";

const GRAPH_API_BASE = "https://graph.facebook.com";
const RATE_LIMIT_CODES = new Set([613, 17]);
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GraphErrorEnvelope = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

export async function publishFbPagePhoto(input: FbPublishPhotoInput): Promise<FbPhotoPublishResult> {
  const version = input.apiVersion ?? "v22.0";
  const url = `${GRAPH_API_BASE}/${version}/${input.pageId}/photos`;

  const imageBuffer = await readFile(input.imagePath);
  const filename = input.imagePath.split(/[\\/]/).pop() ?? "image.jpg";
  const mimeType = filename.endsWith(".png") ? "image/png" : "image/jpeg";

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const form = new FormData();
    form.append("message", input.caption);
    form.append("published", input.scheduledUnix ? "false" : "true");
    if (input.scheduledUnix) {
      form.append("scheduled_publish_time", String(input.scheduledUnix));
    }
    form.append("access_token", input.accessToken);
    form.append("source", new Blob([imageBuffer], { type: mimeType }), filename);

    const response = await fetch(url, { method: "POST", body: form });
    const rawText = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!response.ok) {
        throw new FbPublishError(response.status, null, `Non-JSON response from Graph API: ${rawText.slice(0, 200)}`);
      }
      throw new FbPublishError(0, null, `Unexpected non-JSON success response`);
    }

    if (!response.ok) {
      const errBody = parsed as GraphErrorEnvelope;
      const code = errBody?.error?.code ?? response.status;
      const subcode = errBody?.error?.error_subcode ?? null;
      const message = errBody?.error?.message ?? `HTTP ${response.status}`;

      const isRateLimit = response.status === 429 || RATE_LIMIT_CODES.has(code);

      if (isRateLimit && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt] ?? 4000);
        attempt++;
        continue;
      }

      throw new FbPublishError(code, subcode, message);
    }

    const result = parsed as { id?: string; post_id?: string };

    return {
      id: result.id ?? "",
      post_id: result.post_id ?? result.id ?? "",
    };
  }

  throw new FbPublishError(0, null, "Max retry attempts exceeded");
}

/**
 * Upload a single image to the page as an unpublished photo and return the
 * media id. Used as a building block for carousel / attached_media posts.
 * Takes a publicly-accessible URL — no filesystem reads.
 */
async function uploadUnpublishedPhotoByUrl(input: {
  pageId: string;
  accessToken: string;
  imageUrl: string;
  apiVersion: string;
}): Promise<string> {
  const url = `${GRAPH_API_BASE}/${input.apiVersion}/${input.pageId}/photos`;
  const form = new FormData();
  form.append("url", input.imageUrl);
  form.append("published", "false");
  form.append("access_token", input.accessToken);

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(url, { method: "POST", body: form });
    const rawText = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new FbPublishError(response.status, null, `Non-JSON response uploading carousel photo: ${rawText.slice(0, 200)}`);
    }

    if (!response.ok) {
      const errBody = parsed as GraphErrorEnvelope;
      const code = errBody?.error?.code ?? response.status;
      const message = errBody?.error?.message ?? `HTTP ${response.status}`;
      const isRateLimit = response.status === 429 || RATE_LIMIT_CODES.has(code);
      if (isRateLimit && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt] ?? 4000);
        attempt++;
        continue;
      }
      throw new FbPublishError(code, errBody?.error?.error_subcode ?? null, `uploadUnpublishedPhoto: ${message}`);
    }

    const result = parsed as { id?: string };
    if (!result.id) {
      throw new FbPublishError(0, null, "Photo upload succeeded but no media id returned");
    }
    return result.id;
  }

  throw new FbPublishError(0, null, "Max retry attempts exceeded uploading carousel photo");
}

/**
 * Publish a multi-image carousel post to a Facebook Page. Images are
 * provided as public HTTPS URLs (GCS signed URLs are fine as long as
 * they're valid for the duration of the upload).
 *
 * Flow:
 * 1. For each imageUrl, upload to /{pageId}/photos with published=false
 *    → capture the returned media id.
 * 2. POST to /{pageId}/feed with attached_media referencing those ids
 *    + the caption.
 *
 * Returns the feed post id. On scheduled posts, FB returns the scheduled
 * post id; it will publish at scheduledUnix.
 */
export async function publishFbPageCarousel(input: FbCarouselPublishInput): Promise<FbPhotoPublishResult> {
  const version = input.apiVersion ?? "v22.0";
  if (input.imageUrls.length < 2) {
    throw new FbPublishError(0, null, "Carousel requires at least 2 images");
  }
  if (input.imageUrls.length > 10) {
    throw new FbPublishError(0, null, "Carousel supports at most 10 images");
  }

  const mediaIds = await Promise.all(
    input.imageUrls.map((imageUrl) =>
      uploadUnpublishedPhotoByUrl({
        pageId: input.pageId,
        accessToken: input.accessToken,
        imageUrl,
        apiVersion: version,
      }),
    ),
  );

  const url = `${GRAPH_API_BASE}/${version}/${input.pageId}/feed`;
  const form = new FormData();
  form.append("message", input.caption);
  form.append("access_token", input.accessToken);
  form.append("published", input.scheduledUnix ? "false" : "true");
  if (input.scheduledUnix) {
    form.append("scheduled_publish_time", String(input.scheduledUnix));
  }
  mediaIds.forEach((mediaId, idx) => {
    form.append(`attached_media[${idx}]`, JSON.stringify({ media_fbid: mediaId }));
  });

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(url, { method: "POST", body: form });
    const rawText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new FbPublishError(response.status, null, `Non-JSON response publishing carousel: ${rawText.slice(0, 200)}`);
    }

    if (!response.ok) {
      const errBody = parsed as GraphErrorEnvelope;
      const code = errBody?.error?.code ?? response.status;
      const message = errBody?.error?.message ?? `HTTP ${response.status}`;
      const isRateLimit = response.status === 429 || RATE_LIMIT_CODES.has(code);
      if (isRateLimit && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt] ?? 4000);
        attempt++;
        continue;
      }
      throw new FbPublishError(code, errBody?.error?.error_subcode ?? null, message);
    }

    const result = parsed as { id?: string; post_id?: string };
    return {
      id: result.id ?? "",
      post_id: result.post_id ?? result.id ?? "",
    };
  }

  throw new FbPublishError(0, null, "Max retry attempts exceeded publishing carousel");
}
