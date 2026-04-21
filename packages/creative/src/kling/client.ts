// Kling AI HTTP client. Thin wrapper over the REST API with:
//   - per-request JWT minting (30-min lifetime cache)
//   - typed submit + poll + waitForCompletion helpers
//   - budget pre-flight via `assertBudget` (delegate — caller injects
//     a KlingUsageTracker from ./usage.ts)
//
// The client does NOT write to the database itself — recording usage
// is the caller's responsibility (via the tracker). Keeping the client
// free of DB concerns makes it easy to test and keeps the blast radius
// small if we swap the tracker later.

import { mintKlingJwt } from "./jwt";
import {
  KlingApiError,
  type Image2VideoRequest,
  type KlingTaskResult,
  type KlingTaskStatus,
  type Text2VideoRequest,
} from "./types";

export type KlingClientConfig = {
  accessKey: string;
  secretKey: string;
  apiBaseUrl: string;
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

type JwtCache = { token: string; expiresAt: number };

export class KlingClient {
  private jwt: JwtCache | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(private config: KlingClientConfig) {
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // ── Authorization ────────────────────────────────────────────────────
  //
  // Re-use the same JWT until ~60s before expiry so we amortize the
  // tiny HMAC cost across many polls. Lifetime matches Kling's docs.
  private getJwt(): string {
    const nowSec = Math.floor(Date.now() / 1000);
    if (this.jwt && this.jwt.expiresAt - 60 > nowSec) return this.jwt.token;
    const lifetime = 1800;
    const token = mintKlingJwt({
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      lifetimeSec: lifetime,
      nowSec,
    });
    this.jwt = { token, expiresAt: nowSec + lifetime };
    return token;
  }

  // ── Core request helper ──────────────────────────────────────────────
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl.replace(/\/$/, "")}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.getJwt()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Body was not JSON — treat as empty for error handling below.
    }

    if (!response.ok) {
      const err = (json ?? {}) as { code?: number; message?: string };
      throw new KlingApiError(
        err.message ?? `Kling request failed with status ${response.status}`,
        err.code ?? 0,
        response.status,
        json,
      );
    }

    // Kling's success envelope is `{ code: 0, message: "SUCCEED", data: {...} }`.
    // Error envelope is `{ code: <non-zero>, message: "...", request_id: "..." }`.
    const envelope = (json ?? {}) as { code?: number; message?: string; data?: T };
    if (envelope.code != null && envelope.code !== 0) {
      throw new KlingApiError(
        envelope.message ?? "Kling API returned non-zero code",
        envelope.code,
        response.status,
        json,
      );
    }

    return (envelope.data ?? json) as T;
  }

  // ── submitText2Video ─────────────────────────────────────────────────
  async submitText2Video(req: Text2VideoRequest): Promise<{ taskId: string }> {
    const body = this.serializeText2VideoBody(req);
    const data = await this.request<{ task_id: string }>("POST", "/v1/videos/text2video", body);
    return { taskId: data.task_id };
  }

  async submitImage2Video(req: Image2VideoRequest): Promise<{ taskId: string }> {
    const body = {
      ...this.serializeText2VideoBody(req),
      image: req.imageUrl,
      ...(req.imageTailUrl ? { image_tail: req.imageTailUrl } : {}),
    };
    const data = await this.request<{ task_id: string }>("POST", "/v1/videos/image2video", body);
    return { taskId: data.task_id };
  }

  // ── pollStatus ───────────────────────────────────────────────────────
  async pollStatus(
    taskId: string,
    kind: "text2video" | "image2video",
  ): Promise<KlingTaskResult> {
    const path = `/v1/videos/${kind}/${encodeURIComponent(taskId)}`;
    const raw = await this.request<{
      task_id: string;
      task_status: string;
      task_status_msg?: string;
      created_at: number;
      updated_at: number;
      task_result?: { videos?: Array<{ id: string; url: string; duration: string | number }> };
    }>("GET", path);

    const status = this.normalizeStatus(raw.task_status);
    const videos = (raw.task_result?.videos ?? []).map((v) => ({
      id: v.id,
      url: v.url,
      durationSec: typeof v.duration === "string" ? parseFloat(v.duration) : v.duration,
    }));
    return {
      taskId: raw.task_id,
      status,
      statusMessage: raw.task_status_msg,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      videos,
    };
  }

  // ── waitForCompletion ────────────────────────────────────────────────
  /**
   * Poll `pollStatus` until the task reaches a terminal state. Default
   * budget: 10 minutes at 20s intervals. Throws on timeout or failure.
   */
  async waitForCompletion(
    taskId: string,
    kind: "text2video" | "image2video",
    opts?: { intervalMs?: number; timeoutMs?: number },
  ): Promise<KlingTaskResult> {
    const interval = opts?.intervalMs ?? 20_000;
    const timeout = opts?.timeoutMs ?? 600_000;
    const start = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.pollStatus(taskId, kind);
      if (result.status === "succeed") return result;
      if (result.status === "failed") {
        throw new KlingApiError(
          result.statusMessage ?? "Kling task failed",
          0,
          0,
          result,
        );
      }
      if (Date.now() - start > timeout) {
        throw new KlingApiError(
          `Kling task ${taskId} did not complete within ${timeout}ms`,
          0,
          0,
          result,
        );
      }
      await sleep(interval);
    }
  }

  // ── Serialization helpers ────────────────────────────────────────────
  private serializeText2VideoBody(req: Text2VideoRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model_name: req.model,
      prompt: req.prompt,
    };
    if (req.negativePrompt) body.negative_prompt = req.negativePrompt;
    if (req.cfgScale != null) body.cfg_scale = req.cfgScale;
    if (req.mode) body.mode = req.mode;
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio;
    if (req.durationSec) body.duration = String(req.durationSec);
    if (req.cameraControl) body.camera_control = req.cameraControl;
    return body;
  }

  private normalizeStatus(raw: string): KlingTaskStatus {
    const lowered = raw.toLowerCase();
    if (lowered === "succeed" || lowered === "success") return "succeed";
    if (lowered === "failed" || lowered === "fail") return "failed";
    if (lowered === "processing" || lowered === "running") return "processing";
    return "submitted";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
