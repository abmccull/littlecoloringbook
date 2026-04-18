import { getCanvaAccessToken } from "./oauth.js";
import type {
  CanvaAssetUploadResult,
  CanvaAutofillField,
  CanvaAutofillJobResult,
  CanvaExportJobResult,
} from "./types.js";
import { CanvaError } from "./types.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.2;
}

const BACKOFF_DELAYS_MS = [1_000, 3_000, 9_000];
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000;
const RATE_LIMIT_DELAY_MS = 1_000; // 1-call/sec pacing

// ─── CanvaClient ──────────────────────────────────────────────────────────────

export type CanvaClientOptions = {
  apiBaseUrl?: string;
  /** Injected fetch — used by tests to mock HTTP */
  fetchFn?: typeof fetch;
  /** Override token getter — used by tests */
  getAccessToken?: () => Promise<string>;
};

export class CanvaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly getAccessToken: () => Promise<string>;
  private lastCallAt: number = 0;

  constructor(opts: CanvaClientOptions = {}) {
    this.baseUrl = (
      opts.apiBaseUrl ??
      process.env.CANVA_API_BASE_URL ??
      "https://api.canva.com/rest/v1"
    ).replace(/\/$/, "");
    this.fetchFn = opts.fetchFn ?? fetch;
    this.getAccessToken = opts.getAccessToken ?? (() => getCanvaAccessToken());
  }

  // ─── Rate-limit pacing ──────────────────────────────────────────────────────

  private async pace(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await sleep(RATE_LIMIT_DELAY_MS - elapsed);
    }
    this.lastCallAt = Date.now();
  }

  // ─── Core request with retry ────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: BodyInit;
      headers?: Record<string, string>;
      isRawBody?: boolean;
    } = {},
  ): Promise<T> {
    await this.pace();

    const url = `${this.baseUrl}/${path.replace(/^\//, "")}`;
    const token = await this.getAccessToken();

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let attempt = 0;
    const maxAttempts = BACKOFF_DELAYS_MS.length + 1;

    while (attempt < maxAttempts) {
      const response = await this.fetchFn(url, {
        method,
        headers: { ...authHeaders, ...(options.headers ?? {}) },
        body: options.body,
      });

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < BACKOFF_DELAYS_MS.length
      ) {
        const delay = jitter(BACKOFF_DELAYS_MS[attempt]);
        attempt++;
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        throw new CanvaError(
          `CANVA_HTTP_${response.status}`,
          `Canva API ${method} /${path} returned HTTP ${response.status}`,
          response.status,
          parsed,
        );
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    throw new CanvaError(
      "CANVA_MAX_RETRIES",
      `Canva API ${method} /${path} exceeded max retry attempts`,
    );
  }

  // ─── Polling helper ─────────────────────────────────────────────────────────

  private async pollUntilDone<T extends { job: { status: string; error?: { code: string; message: string } } }>(
    getJobFn: () => Promise<T>,
    resourceName: string,
  ): Promise<T> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const result = await getJobFn();
      const { status, error } = result.job;

      if (status === "success") {
        return result;
      }

      if (status === "failed") {
        throw new CanvaError(
          error?.code ?? "CANVA_JOB_FAILED",
          error?.message ?? `Canva ${resourceName} job failed`,
        );
      }

      // queued or in_progress — keep polling
      await sleep(POLL_INTERVAL_MS);
    }

    throw new CanvaError(
      "CANVA_POLL_TIMEOUT",
      `Canva ${resourceName} job did not complete within ${POLL_TIMEOUT_MS / 1000}s`,
    );
  }

  // ─── Public API methods ─────────────────────────────────────────────────────

  /**
   * Upload a raw image buffer to Canva's asset-uploads endpoint.
   * Returns the stable asset_id once the async upload job succeeds.
   */
  async uploadAsset({
    buffer,
    mimeType,
    name = "hero_image",
  }: {
    buffer: Buffer;
    mimeType: string;
    name?: string;
  }): Promise<{ asset_id: string }> {
    const metadata = JSON.stringify({
      name,
      size_in_bytes: buffer.length,
      mime_type: mimeType,
    });

    // Initial POST — body is the raw image bytes
    // Buffer.buffer gives the underlying ArrayBuffer which satisfies BodyInit
    const initial = await this.request<CanvaAssetUploadResult>("POST", "asset-uploads", {
      body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      headers: {
        "Content-Type": mimeType,
        "Asset-Upload-Metadata": metadata,
      },
      isRawBody: true,
    });

    const jobId = initial.job.id;

    if (initial.job.status === "success") {
      const assetId = initial.job.asset?.id;
      if (!assetId) {
        throw new CanvaError("CANVA_ASSET_ID_MISSING", "Asset upload succeeded but returned no asset.id");
      }
      return { asset_id: assetId };
    }

    // Poll until done
    const done = await this.pollUntilDone<CanvaAssetUploadResult>(
      () => this.request<CanvaAssetUploadResult>("GET", `asset-uploads/${jobId}`),
      "asset-upload",
    );

    const assetId = done.job.asset?.id;
    if (!assetId) {
      throw new CanvaError("CANVA_ASSET_ID_MISSING", "Asset upload completed but returned no asset.id");
    }

    return { asset_id: assetId };
  }

  /**
   * Trigger a brand template autofill job and return the new designId.
   */
  async autofillBrandTemplate({
    brandTemplateId,
    data,
  }: {
    brandTemplateId: string;
    data: Record<string, CanvaAutofillField>;
  }): Promise<{ designId: string }> {
    const initial = await this.request<CanvaAutofillJobResult>("POST", "autofills", {
      body: JSON.stringify({ brand_template_id: brandTemplateId, data }),
      headers: { "Content-Type": "application/json" },
    });

    const jobId = initial.job.id;

    const done =
      initial.job.status === "success"
        ? initial
        : await this.pollUntilDone<CanvaAutofillJobResult>(
            () => this.request<CanvaAutofillJobResult>("GET", `autofills/${jobId}`),
            "autofill",
          );

    const designId = done.job.result?.design.id;
    if (!designId) {
      throw new CanvaError(
        "CANVA_DESIGN_ID_MISSING",
        "Autofill job completed but returned no design.id",
      );
    }

    return { designId };
  }

  /**
   * Export a Canva design to PNG (or another format) and return the download URL.
   */
  async exportDesign({
    designId,
    format = "png",
  }: {
    designId: string;
    format?: "png" | "jpg" | "pdf";
  }): Promise<{ downloadUrl: string }> {
    const initial = await this.request<CanvaExportJobResult>("POST", "exports", {
      body: JSON.stringify({ design_id: designId, format: { type: format } }),
      headers: { "Content-Type": "application/json" },
    });

    const jobId = initial.job.id;

    const done =
      initial.job.status === "success"
        ? initial
        : await this.pollUntilDone<CanvaExportJobResult>(
            () => this.request<CanvaExportJobResult>("GET", `exports/${jobId}`),
            "export",
          );

    const downloadUrl = done.job.urls?.[0];
    if (!downloadUrl) {
      throw new CanvaError(
        "CANVA_EXPORT_URL_MISSING",
        "Export job completed but returned no download URL",
      );
    }

    return { downloadUrl };
  }

  /**
   * Fetch a Canva signed export URL and return the image as a Node Buffer.
   */
  async fetchDesignAsBuffer({ downloadUrl }: { downloadUrl: string }): Promise<Buffer> {
    // Signed URLs — no auth header needed; still apply pacing
    await this.pace();

    const response = await this.fetchFn(downloadUrl, { method: "GET" });

    if (!response.ok) {
      throw new CanvaError(
        `CANVA_DOWNLOAD_FAILED`,
        `Fetching Canva export from signed URL returned HTTP ${response.status}`,
        response.status,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
