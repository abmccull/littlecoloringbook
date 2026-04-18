import { createHash } from "node:crypto";
import { recordMetaApiCall } from "@littlecolorbook/db/repositories";
import {
  APP_RATE_LIMIT_RPS,
  BACKOFF_DELAYS_MS,
  GRAPH_API_BASE,
  RATE_LIMIT_ERROR_CODES,
} from "./constants";
import type { RateLimitHeaders } from "./types";

export class CapiSendError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | null,
    message: string,
  ) {
    super(message);
    this.name = "CapiSendError";
  }
}

type TokenBucket = {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRatePerMs: number;
};

function createBucket(capacityPerSecond: number): TokenBucket {
  return {
    tokens: capacityPerSecond,
    lastRefill: Date.now(),
    capacity: capacityPerSecond,
    refillRatePerMs: capacityPerSecond / 1000,
  };
}

function consumeToken(bucket: TokenBucket): boolean {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRatePerMs);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.2;
}

function parseUsagePercent(header: string | null): number | null {
  if (!header) return null;
  try {
    const parsed = JSON.parse(header) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as Record<string, unknown>;
      const pct = first["call_count"] ?? first["percentage"];
      return typeof pct === "number" ? pct : null;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const pct = obj["call_count"] ?? obj["percentage"];
      return typeof pct === "number" ? pct : null;
    }
  } catch {
    // unparseable — ignore
  }
  return null;
}

type GraphClientOptions = {
  accessToken: string;
  version?: string;
  adAccountId?: string;
};

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

export class GraphClient {
  private readonly accessToken: string;
  private readonly version: string;
  private readonly adAccountId: string | undefined;
  private readonly appBucket: TokenBucket;
  private latestHeaders: RateLimitHeaders = {
    appUsage: null,
    adAccountUsage: null,
    bucUsage: null,
  };

  constructor(options: GraphClientOptions) {
    this.accessToken = options.accessToken;
    this.version = options.version ?? "v22.0";
    this.adAccountId = options.adAccountId;
    this.appBucket = createBucket(APP_RATE_LIMIT_RPS);
  }

  get rateLimitHeaders(): RateLimitHeaders {
    return this.latestHeaders;
  }

  async get<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
    return this.request<T>("GET", path, params);
  }

  async post<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    data: Record<string, unknown> = {},
  ): Promise<T> {
    // Rate-limit: wait until a token is available (up to 200ms polling).
    for (let wait = 0; wait < 200; wait += 5) {
      if (consumeToken(this.appBucket)) break;
      await sleep(5);
    }

    const endpoint = `${GRAPH_API_BASE}/${this.version}/${path.replace(/^\//, "")}`;
    const callId = createHash("sha256")
      .update(`${method}:${endpoint}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16);

    let payloadHash: string | undefined;

    let attempt = 0;
    const maxAttempts = BACKOFF_DELAYS_MS.length + 1;

    while (attempt < maxAttempts) {
      const startMs = Date.now();
      let responseStatus: number | undefined;
      let responseExcerpt: string | undefined;
      let errorCode: number | undefined;
      let errorSubcode: number | undefined;

      try {
        let url: string;
        let fetchOptions: RequestInit;

        if (method === "GET") {
          const qs = new URLSearchParams({
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)]),
            ),
            access_token: this.accessToken,
          });
          url = `${endpoint}?${qs.toString()}`;
          fetchOptions = { method: "GET" };
        } else {
          url = endpoint;
          const bodyObj = { ...data, access_token: this.accessToken };
          const bodyStr = JSON.stringify(bodyObj);
          payloadHash = createHash("sha256").update(bodyStr).digest("hex").slice(0, 16);
          fetchOptions = {
            method,
            headers: { "Content-Type": "application/json" },
            body: bodyStr,
          };
        }

        const response = await fetch(url, fetchOptions);
        const durationMs = Date.now() - startMs;
        responseStatus = response.status;

        this.latestHeaders = {
          appUsage: parseUsagePercent(response.headers.get("X-App-Usage")),
          adAccountUsage: parseUsagePercent(response.headers.get("X-Ad-Account-Usage")),
          bucUsage: parseUsagePercent(response.headers.get("X-Business-Use-Case-Usage")),
        };

        const rawText = await response.text();
        responseExcerpt = rawText.slice(0, 500);

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          if (!response.ok) {
            throw new CapiSendError(responseStatus, null, `Graph API returned ${responseStatus}: ${responseExcerpt}`);
          }
          return rawText as unknown as T;
        }

        if (!response.ok) {
          const errBody = parsed as GraphErrorBody;
          const code = errBody?.error?.code ?? responseStatus;
          const subcode = errBody?.error?.error_subcode ?? null;
          const message = errBody?.error?.message ?? `HTTP ${responseStatus}`;
          errorCode = code;
          errorSubcode = subcode ?? undefined;

          const isRateLimit =
            response.status === 429 ||
            (RATE_LIMIT_ERROR_CODES as readonly number[]).includes(code);

          if (isRateLimit && attempt < BACKOFF_DELAYS_MS.length) {
            const delay = jitter(BACKOFF_DELAYS_MS[attempt]);
            this.fireAndForgetCallRecord({
              id: `${callId}_${attempt}`,
              method,
              endpoint,
              payloadHash,
              responseStatus,
              responseExcerpt,
              bucUsagePercent: this.latestHeaders.bucUsage ?? undefined,
              durationMs,
              errorCode,
              errorSubcode,
            });
            attempt++;
            await sleep(delay);
            continue;
          }

          throw new CapiSendError(code, subcode, message);
        }

        this.fireAndForgetCallRecord({
          id: callId,
          method,
          endpoint,
          payloadHash,
          responseStatus,
          responseExcerpt,
          bucUsagePercent: this.latestHeaders.bucUsage ?? undefined,
          durationMs,
          errorCode,
          errorSubcode,
        });

        return parsed as T;
      } catch (error) {
        const durationMs = Date.now() - startMs;

        if (error instanceof CapiSendError) {
          this.fireAndForgetCallRecord({
            id: `${callId}_err`,
            method,
            endpoint,
            payloadHash,
            responseStatus,
            responseExcerpt,
            bucUsagePercent: this.latestHeaders.bucUsage ?? undefined,
            durationMs,
            errorCode: error.code,
            errorSubcode: error.subcode ?? undefined,
          });
          throw error;
        }

        // Network-level error — retry with backoff.
        if (attempt < BACKOFF_DELAYS_MS.length) {
          attempt++;
          await sleep(jitter(BACKOFF_DELAYS_MS[attempt - 1]));
          continue;
        }

        throw error;
      }
    }

    throw new CapiSendError(0, null, "Max retry attempts exceeded");
  }

  private fireAndForgetCallRecord(params: {
    id: string;
    method: string;
    endpoint: string;
    payloadHash?: string;
    responseStatus?: number;
    responseExcerpt?: string;
    bucUsagePercent?: number;
    durationMs?: number;
    errorCode?: number;
    errorSubcode?: number;
  }) {
    recordMetaApiCall({
      id: params.id,
      method: params.method,
      endpoint: params.endpoint,
      payloadHash: params.payloadHash ?? null,
      responseStatus: params.responseStatus ?? null,
      responseExcerpt: params.responseExcerpt ?? null,
      bucUsagePercent: params.bucUsagePercent ?? null,
      durationMs: params.durationMs ?? null,
      errorCode: params.errorCode ?? null,
      errorSubcode: params.errorSubcode ?? null,
    }).catch((err: unknown) => {
      console.error("[GraphClient] failed to record API call", err);
    });
  }
}
