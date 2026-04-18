import {
  GammaError,
  GammaGenerationRequestSchema,
  GammaGenerationResponseSchema,
} from "./types";
import type { GammaGenerationRequest, GammaGenerationResponse } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.3;
}

/** Backoff delays in ms for 429 / 5xx retries (2 attempts beyond the first). */
const BACKOFF_DELAYS_MS = [2_000, 6_000] as const;

// ---------------------------------------------------------------------------
// GammaClient
// ---------------------------------------------------------------------------

type GammaClientOptions = {
  apiKey: string;
  baseUrl: string;
  /**
   * Backoff delays in ms for 429/5xx retries.
   * Defaults to [2000, 6000] in production.
   * Pass [0, 0] in tests to skip real sleeping.
   */
  backoffDelaysMs?: readonly [number, number];
};

type GenerateAndWaitOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export class GammaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly backoffDelaysMs: readonly [number, number];

  constructor({ apiKey, baseUrl, backoffDelaysMs }: GammaClientOptions) {
    if (!apiKey) throw new GammaError("apiKey is required", "MISSING_API_KEY");
    if (!baseUrl) throw new GammaError("baseUrl is required", "MISSING_BASE_URL");
    this.apiKey = apiKey;
    // Strip trailing slash so we can always append /path cleanly.
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.backoffDelaysMs = backoffDelaysMs ?? BACKOFF_DELAYS_MS;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * POST /generations — submit a generation job.
   * Returns immediately with the generationId; use getStatus() or generateAndWait() to track progress.
   */
  async generate(request: GammaGenerationRequest): Promise<{ generationId: string }> {
    const validated = GammaGenerationRequestSchema.parse(request);

    const body = await this.fetchWithRetry<{ id: string }>(
      `${this.baseUrl}/generations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify(validated),
      },
    );

    if (!body.id) {
      throw new GammaError("Gamma /generations response missing `id` field", "INVALID_RESPONSE");
    }

    return { generationId: body.id };
  }

  /**
   * GET /generations/{id} — poll the status of a generation job.
   */
  async getStatus(generationId: string): Promise<GammaGenerationResponse> {
    if (!generationId) {
      throw new GammaError("generationId is required", "MISSING_GENERATION_ID");
    }

    const raw = await this.fetchWithRetry<unknown>(
      `${this.baseUrl}/generations/${encodeURIComponent(generationId)}`,
      {
        method: "GET",
        headers: {
          "X-API-KEY": this.apiKey,
        },
      },
    );

    const parsed = GammaGenerationResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new GammaError(
        `Gamma status response did not match expected schema: ${parsed.error.message}`,
        "INVALID_RESPONSE",
      );
    }

    return parsed.data;
  }

  /**
   * Submits a generation job then polls until completed, failed, or timeout.
   *
   * @param request - Generation parameters.
   * @param options.timeoutMs - Maximum total wait time in ms (default: 120 000).
   * @param options.pollIntervalMs - Polling cadence in ms (default: 4 000).
   * @returns The completed GammaGenerationResponse (includes export URLs).
   * @throws GammaError if the job fails or times out.
   */
  async generateAndWait(
    request: GammaGenerationRequest,
    { timeoutMs = 120_000, pollIntervalMs = 4_000 }: GenerateAndWaitOptions = {},
  ): Promise<GammaGenerationResponse> {
    const { generationId } = await this.generate(request);

    const deadline = Date.now() + timeoutMs;

    while (true) {
      const status = await this.getStatus(generationId);

      if (status.status === "completed") {
        return status;
      }

      if (status.status === "failed") {
        throw new GammaError(
          `Gamma generation ${generationId} failed: ${status.errorMessage ?? "unknown reason"}`,
          "GENERATION_FAILED",
        );
      }

      // status === "pending" — check timeout before sleeping.
      if (Date.now() + pollIntervalMs > deadline) {
        throw new GammaError(
          `Gamma generation ${generationId} did not complete within ${timeoutMs}ms`,
          "TIMEOUT",
        );
      }

      await sleep(pollIntervalMs);
    }
  }

  /**
   * Downloads each per-slide PNG from a completed generation response.
   *
   * Throws GammaError if the response does not contain per-slide PNG exports
   * (i.e. the generation was requested with exportAs:"pdf" or without exportAs).
   *
   * @returns Array of Buffers in slide order.
   */
  async downloadSlidePngs(response: GammaGenerationResponse): Promise<Buffer[]> {
    const pngExports = (response.exports ?? []).filter(
      (e) =>
        // Accept entries explicitly typed as PNG or without contentType (Gamma
        // may omit it) as long as they have a URL and a cardIndex.
        e.cardIndex !== undefined &&
        (e.contentType === undefined ||
          e.contentType === "image/png" ||
          e.contentType.startsWith("image/")),
    );

    if (pngExports.length === 0) {
      throw new GammaError(
        'PNG export not available — request exportAs:"png" with numCards set',
        "NO_PNG_EXPORTS",
      );
    }

    // Sort by cardIndex ascending so callers get slides in order.
    const sorted = [...pngExports].sort(
      (a, b) => (a.cardIndex ?? 0) - (b.cardIndex ?? 0),
    );

    const buffers = await Promise.all(
      sorted.map(async (exportEntry) => {
        const res = await fetch(exportEntry.url);
        if (!res.ok) {
          throw new GammaError(
            `Failed to download PNG at ${exportEntry.url}: HTTP ${res.status}`,
            "DOWNLOAD_FAILED",
            res.status,
          );
        }
        return Buffer.from(await res.arrayBuffer());
      }),
    );

    return buffers;
  }

  // -------------------------------------------------------------------------
  // Private: rate-limit-aware fetch with retry
  // -------------------------------------------------------------------------

  /**
   * Fetches `url` with `init`, retrying up to 2 times on 429 or 5xx responses
   * with exponential backoff (2 s, 6 s + up to 30 % jitter).
   */
  private async fetchWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    let attempt = 0;
    const maxAttempts = this.backoffDelaysMs.length + 1;

    while (attempt < maxAttempts) {
      const res = await fetch(url, init);

      if (res.ok) {
        return (await res.json()) as T;
      }

      const shouldRetry =
        (res.status === 429 || res.status >= 500) &&
        attempt < this.backoffDelaysMs.length;

      if (shouldRetry) {
        const delay = jitter(this.backoffDelaysMs[attempt]);
        attempt++;
        await sleep(delay);
        continue;
      }

      // Non-retryable error — parse body for a useful message and throw.
      let errorMessage = `Gamma API error ${res.status}`;
      try {
        const errBody = (await res.json()) as { message?: string; error?: string };
        errorMessage = errBody.message ?? errBody.error ?? errorMessage;
      } catch {
        // ignore JSON parse failure
      }

      throw new GammaError(errorMessage, "API_ERROR", res.status);
    }

    throw new GammaError("Max retry attempts exceeded", "MAX_RETRIES_EXCEEDED");
  }
}
