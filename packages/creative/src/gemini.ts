// Thin Gemini image-generation caller for the creative package.
// Mirrors the fetch pattern in packages/pipeline/src/index.ts without
// importing from there (pipeline is tightly coupled to order flows).

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return key;
}

function getGeminiApiBaseUrl(): string {
  return process.env.GEMINI_API_BASE_URL ?? "https://generativelanguage.googleapis.com";
}

function getGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
}

type GeneratedImagePart = {
  data: string;
  mimeType: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractGeneratedImage(payload: Record<string, unknown>): GeneratedImagePart {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];

    for (const part of parts) {
      const partRecord = asRecord(part);
      const inlineData =
        asRecord(partRecord?.inlineData) ?? asRecord(partRecord?.inline_data);
      const data =
        typeof inlineData?.data === "string" ? inlineData.data : null;
      const mimeType =
        typeof inlineData?.mimeType === "string"
          ? inlineData.mimeType
          : typeof inlineData?.mime_type === "string"
            ? inlineData.mime_type
            : null;

      if (data && mimeType) {
        return { data, mimeType };
      }
    }
  }

  const message = candidates
    .map((candidate) => {
      const parts = Array.isArray(
        asRecord(asRecord(candidate)?.content)?.parts,
      )
        ? ((asRecord(candidate)?.content as Record<string, unknown>)
            .parts as unknown[])
        : [];
      return parts
        .map((part) => {
          const text = asRecord(part)?.text;
          return typeof text === "string" ? text : null;
        })
        .filter((v): v is string => Boolean(v))
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");

  throw new Error(message || "Gemini did not return an image.");
}

export type RenderColoringPageImageInput = {
  sourceImageBuffer: Buffer;
  mimeType: string;
  prompt: string;
  model?: string;
  aspectRatio?: string;
};

export type RenderColoringPageImageResult = {
  buffer: Buffer;
  mimeType: string;
};

// 429 backoff: 1s → 2s → 4s, matching the pipeline's pattern.
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

export async function renderColoringPageImage(
  input: RenderColoringPageImageInput,
): Promise<RenderColoringPageImageResult> {
  const model = input.model ?? getGeminiImageModel();
  const aspectRatio = input.aspectRatio ?? "3:4";

  let response: Response | null = null;
  let payload: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt++) {
    response = await fetch(
      `${getGeminiApiBaseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getGeminiApiKey(),
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: input.prompt },
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.sourceImageBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio },
          },
        }),
        cache: "no-store",
      },
    );

    if (response.status === 429 && attempt < BACKOFF_DELAYS_MS.length) {
      const delayMs =
        (BACKOFF_DELAYS_MS[attempt] ?? 1000) + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    break;
  }

  payload = (await response!.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response!.ok || !payload) {
    const detail =
      (payload &&
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : null) ??
      `Gemini image generation failed with status ${response!.status}.`;
    throw new Error(detail);
  }

  const imagePart = extractGeneratedImage(payload);
  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType,
  };
}
