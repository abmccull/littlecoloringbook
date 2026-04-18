import {
  VoiceoverError,
  VoiceoverRequestSchema,
  VoiceListResponseSchema,
} from "./types";
import type { Voice, VoiceFamily, VoiceoverRequestInput } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.3;
}

const DEFAULT_RETRY_AFTER_MS = 5_000;
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Voice-family matching
// ---------------------------------------------------------------------------

/**
 * Scoring rules for each voice family.
 *
 * `requiredGender` is enforced as a hard filter — voices that don't match are excluded entirely.
 * `scoringRules` award points; the voice with the most points wins.
 */
// Use string for key so TypeScript doesn't narrow to `never` when indexing
// the optional-field VoiceLabels record with a union key.
type LabelCheck = { key: string; values: string[] };

type FamilySpec = {
  requiredGender: string;
  scoringRules: LabelCheck[];
};

const FAMILY_SPECS: Record<VoiceFamily, FamilySpec> = {
  warm_conversational_female: {
    requiredGender: "female",
    scoringRules: [
      { key: "age", values: ["young", "middle aged"] },
      { key: "use_case", values: ["conversational", "social media"] },
      { key: "description", values: ["warm", "casual", "natural"] },
    ],
  },
  upbeat_female: {
    requiredGender: "female",
    scoringRules: [
      { key: "age", values: ["young"] },
      { key: "use_case", values: ["social media", "advertisement"] },
      { key: "description", values: ["energetic", "upbeat", "cheerful", "lively"] },
    ],
  },
  calm_premium_female: {
    requiredGender: "female",
    scoringRules: [
      { key: "age", values: ["middle aged", "old"] },
      { key: "use_case", values: ["narration", "audiobook", "meditation"] },
      { key: "description", values: ["calm", "soft", "premium", "mature", "smooth"] },
    ],
  },
  friendly_gift_guide: {
    requiredGender: "female",
    scoringRules: [
      { key: "use_case", values: ["conversational", "social media", "advertisement"] },
      { key: "description", values: ["friendly", "approachable", "inviting"] },
      { key: "age", values: ["young"] },
    ],
  },
};

function scoreVoice(voice: Voice, rules: LabelCheck[]): number {
  const labels = voice.labels as Record<string, string | undefined> | undefined ?? {};
  let score = 0;

  for (const rule of rules) {
    const labelValue = (labels[rule.key] ?? "").toLowerCase();
    if (rule.values.some((v) => labelValue.includes(v.toLowerCase()))) {
      score++;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// ElevenLabsClient
// ---------------------------------------------------------------------------

type ElevenLabsClientOptions = {
  apiKey: string;
  baseUrl: string;
  defaultModelId?: string;
  /**
   * Default delay in ms when no Retry-After header is present on 429.
   * Defaults to 5000 in production. Pass 0 in tests to skip sleeping.
   */
  defaultRetryAfterMs?: number;
};

export class ElevenLabsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModelId: string;
  private readonly defaultRetryAfterMs: number;

  constructor({ apiKey, baseUrl, defaultModelId, defaultRetryAfterMs }: ElevenLabsClientOptions) {
    if (!apiKey) throw new VoiceoverError("apiKey is required", "MISSING_API_KEY");
    if (!baseUrl) throw new VoiceoverError("baseUrl is required", "MISSING_BASE_URL");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModelId = defaultModelId ?? "eleven_multilingual_v2";
    this.defaultRetryAfterMs = defaultRetryAfterMs ?? DEFAULT_RETRY_AFTER_MS;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * GET /v1/voices — list all voices available to this API key.
   */
  async listVoices(): Promise<Voice[]> {
    const raw = await this.fetchWithRetry<unknown>(
      `${this.baseUrl}/v1/voices`,
      { method: "GET", headers: this.commonHeaders() },
    );

    const parsed = VoiceListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new VoiceoverError(
        `ElevenLabs /v1/voices response did not match expected schema: ${parsed.error.message}`,
        "INVALID_RESPONSE",
      );
    }

    return parsed.data.voices;
  }

  /**
   * POST /v1/text-to-speech/{voice_id}
   *
   * Synthesizes `text` using the specified voice and returns the audio as a Buffer.
   * Defaults to mp3_44100_128 output format.
   */
  async synthesize(
    request: VoiceoverRequestInput,
  ): Promise<{ audioBuffer: Buffer; contentType: string }> {
    const validated = VoiceoverRequestSchema.parse(request);
    const { voiceId, text, modelId, voiceSettings, outputFormat } = validated;

    const url = new URL(
      `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    );
    if (outputFormat) {
      url.searchParams.set("output_format", outputFormat);
    }

    const bodyPayload: Record<string, unknown> = {
      text,
      model_id: modelId ?? this.defaultModelId,
    };
    if (voiceSettings) {
      bodyPayload.voice_settings = voiceSettings;
    }

    const res = await this.fetchRawWithRetry(url.toString(), {
      method: "POST",
      headers: {
        ...this.commonHeaders(),
        "Content-Type": "application/json",
        Accept: this.mimeForFormat(outputFormat ?? "mp3_44100_128"),
      },
      body: JSON.stringify(bodyPayload),
    });

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("Content-Type") ?? this.mimeForFormat(outputFormat ?? "mp3_44100_128");

    return { audioBuffer, contentType };
  }

  /**
   * Picks the best matching voice for a semantic voice family from a list.
   *
   * The family taxonomy maps to ElevenLabs voice metadata labels.
   * Returns null if no voice scores at least 1 point (gender match).
   */
  resolveVoiceForFamily(voiceFamily: VoiceFamily, voices: Voice[]): Voice | null {
    const spec = FAMILY_SPECS[voiceFamily];

    // Hard filter: only consider voices with a matching gender label.
    const candidates = voices.filter((v) => {
      const gender = (v.labels?.gender ?? "").toLowerCase();
      return gender === spec.requiredGender.toLowerCase();
    });

    if (candidates.length === 0) return null;

    let bestVoice: Voice = candidates[0];
    let bestScore = scoreVoice(candidates[0], spec.scoringRules);

    for (let i = 1; i < candidates.length; i++) {
      const score = scoreVoice(candidates[i], spec.scoringRules);
      if (score > bestScore) {
        bestScore = score;
        bestVoice = candidates[i];
      }
    }

    return bestVoice;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private commonHeaders(): Record<string, string> {
    return { "xi-api-key": this.apiKey };
  }

  private mimeForFormat(format: string): string {
    if (format.startsWith("mp3")) return "audio/mpeg";
    if (format.startsWith("pcm")) return "audio/wav";
    if (format.startsWith("ulaw")) return "audio/basic";
    return "audio/mpeg";
  }

  /**
   * Fetch JSON with automatic retry on 429 / 5xx.
   * Respects the `Retry-After` header when present.
   */
  private async fetchWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    const res = await this.fetchRawWithRetry(url, init);
    return (await res.json()) as T;
  }

  /**
   * Low-level fetch with retry that returns the raw Response.
   * Used for both JSON and binary (audio) responses.
   */
  private async fetchRawWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;

    while (attempt < MAX_ATTEMPTS) {
      const res = await fetch(url, init);

      if (res.ok) {
        return res;
      }

      const isRetryable = res.status === 429 || res.status >= 500;

      if (isRetryable && attempt < MAX_ATTEMPTS - 1) {
        // Honour Retry-After header if provided.
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader
          ? parseFloat(retryAfterHeader) * 1_000
          : jitter(this.defaultRetryAfterMs);

        attempt++;
        await sleep(retryAfterMs);
        continue;
      }

      // Non-retryable or exhausted attempts — throw a typed error.
      let errorMessage = `ElevenLabs API error ${res.status}`;
      try {
        const errBody = (await res.json()) as { detail?: { message?: string } | string };
        if (typeof errBody.detail === "string") {
          errorMessage = errBody.detail;
        } else if (errBody.detail?.message) {
          errorMessage = errBody.detail.message;
        }
      } catch {
        // ignore JSON parse failure
      }

      throw new VoiceoverError(errorMessage, "API_ERROR", res.status);
    }

    throw new VoiceoverError("Max retry attempts exceeded", "MAX_RETRIES_EXCEEDED");
  }
}
