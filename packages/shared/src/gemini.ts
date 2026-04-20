import { asRecord } from "./records";

export type GeneratedImagePart = {
  data: string;
  mimeType: string;
};

export function extractGeneratedImage(payload: Record<string, unknown>): GeneratedImagePart {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];

    for (const part of parts) {
      const partRecord = asRecord(part);
      const inlineData = asRecord(partRecord?.inlineData) ?? asRecord(partRecord?.inline_data);
      const data = typeof inlineData?.data === "string" ? inlineData.data : null;
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
      const parts = Array.isArray(asRecord(asRecord(candidate)?.content)?.parts)
        ? ((asRecord(candidate)?.content as Record<string, unknown>).parts as unknown[])
        : [];
      return parts
        .map((part) => {
          const text = asRecord(part)?.text;
          return typeof text === "string" ? text : null;
        })
        .filter((value): value is string => Boolean(value))
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");

  throw new Error(message || "Gemini did not return an image.");
}
