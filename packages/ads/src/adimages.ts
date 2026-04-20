import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { GraphClient } from "@littlecolorbook/meta";

const GRAPH_API_BASE = "https://graph.facebook.com";

type UploadAdImageInput = {
  client: GraphClient;
  adAccountId: string;
  imagePath: string;
};

type UploadAdImageResult = {
  hash: string;
};

type UploadAdImageBufferRawInput = {
  accessToken: string;
  version: string;
  adAccountId: string;
  imageBuffer: Buffer;
  filename: string;
  mimeType: string;
};

type UploadAdImageRawInput = {
  accessToken: string;
  version: string;
  adAccountId: string;
  imagePath: string;
};

// Multipart image upload to /act_{id}/adimages.
// GraphClient.post() sends JSON; for multipart we bypass it and use raw fetch
// with the same access token that the client holds internally.
export async function uploadAdImage(input: UploadAdImageInput): Promise<UploadAdImageResult> {
  const { adAccountId, imagePath } = input;

  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";

  void imageBuffer;
  void filename;
  void mimeType;
  void adAccountId;

  throw new Error(
    "uploadAdImage must be called via uploadAdImageRaw or uploadAdImageBufferRaw â€” see adimages.ts for the raw signatures.",
  );
}

export async function uploadAdImageBufferRaw(input: UploadAdImageBufferRawInput): Promise<UploadAdImageResult> {
  const { accessToken, version, adAccountId, imageBuffer, filename, mimeType } = input;
  const imageBytes = new Uint8Array(imageBuffer);

  const form = new FormData();
  form.append("access_token", accessToken);
  form.append("filename", new Blob([imageBytes], { type: mimeType }), filename);

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

  const images = (parsed as { images?: Record<string, { hash: string }> }).images ?? {};
  const firstKey = Object.keys(images)[0];
  const hash = firstKey ? images[firstKey]?.hash : undefined;

  if (!hash) {
    throw new Error(`adimages upload: could not extract hash from response: ${rawText.slice(0, 300)}`);
  }

  return { hash };
}

export async function uploadAdImageRaw(input: UploadAdImageRawInput): Promise<UploadAdImageResult> {
  const { accessToken, version, adAccountId, imagePath } = input;

  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";

  return uploadAdImageBufferRaw({
    accessToken,
    version,
    adAccountId,
    imageBuffer,
    filename,
    mimeType,
  });
}
