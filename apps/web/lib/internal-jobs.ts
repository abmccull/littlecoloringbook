import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { enqueueProcessingJob, isDatabaseConfigured } from "@littlecolorbook/db";
import type { ProcessingJobKind, ProcessingJobPayloadMap } from "@littlecolorbook/db";

type InternalJobName = ProcessingJobKind;
type InternalJobPayloadMap = ProcessingJobPayloadMap;

export function getInternalJobSecret() {
  return process.env.CRON_SECRET ?? process.env.INTERNAL_JOB_SECRET ?? null;
}

export function isInternalJobSecretConfigured() {
  return Boolean(getInternalJobSecret());
}

export function authorizeInternalJobRequest(request: NextRequest) {
  const secret = getInternalJobSecret();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET or INTERNAL_JOB_SECRET must be configured in production." }, { status: 503 });
    }

    return null;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const headerToken = request.headers.get("x-internal-job-secret");
  const token = bearerToken ?? headerToken;

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function getInternalJobBaseUrl() {
  const productionCandidates = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.APP_URL ?? null,
  ];

  if (process.env.NODE_ENV === "production") {
    const resolved = productionCandidates.find(Boolean);
    if (resolved) {
      return resolved;
    }
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL or a Vercel deployment URL must be configured before dispatching internal jobs in production.");
  }

  return "http://127.0.0.1:3000";
}

const internalJobPathByName: Record<InternalJobName, string> = {
  "process-sample": "/api/internal/jobs/process-sample",
  "process-paid-order": "/api/internal/jobs/process-paid-order",
  "submit-lulu": "/api/internal/jobs/submit-lulu",
  "sync-lulu-status": "/api/internal/jobs/sync-lulu-status",
  "process-capi-event": "/api/internal/jobs/process-capi-event",
};

export async function dispatchInternalJob<TResponse>(input: {
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}) {
  const url = new URL(input.path, getInternalJobBaseUrl());
  const headers = new Headers();
  const secret = getInternalJobSecret();

  if (secret) {
    headers.set("Authorization", `Bearer ${secret}`);
  }

  if (input.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method: input.method ?? "POST",
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
    // Never follow redirects. Cross-origin redirects (e.g. apex → www)
    // strip the Authorization header by browser-security default,
    // which surfaces as a 401 from the internal endpoint — a confusing
    // failure mode when APP_URL is pointed at a non-canonical domain.
    // Fail loudly at dispatch time so the misconfiguration is obvious.
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "(none)";
    throw new Error(
      `Internal job dispatch redirected ${response.status} to ${location}. Point APP_URL at the canonical deployment URL to avoid auth-header-stripping redirects.`,
    );
  }

  const payload = (await response.json().catch(() => null)) as TResponse | { error?: string } | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : `Internal job request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as TResponse;
}

function shouldPreferDirectDispatchInDev(fallbackToDirectOnQueueError?: boolean) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (!fallbackToDirectOnQueueError) {
    return false;
  }

  return process.env.FORCE_ASYNC_INTERNAL_JOBS_IN_DEV !== "true";
}

/**
 * Enqueue an internal job onto the Postgres-backed processing queue.
 * `enqueueProcessingJob` writes a row that the dedicated worker polls
 * every ~2s and hands off to the handlers in packages/jobs.
 *
 * In local dev, defaults to synchronous HTTP dispatch so sample /
 * order generation remains testable without a second worker process.
 * Set FORCE_ASYNC_INTERNAL_JOBS_IN_DEV=true to use the Postgres queue
 * locally.
 */
export async function enqueueInternalJob<TName extends InternalJobName>(input: {
  job: TName;
  payload: InternalJobPayloadMap[TName];
  /** Optional deduplication key. Writes to the job_key column so repeat enqueues collapse. */
  jobKey?: string;
  /** When true, fall back to synchronous HTTP dispatch if the DB is unreachable. */
  fallbackToDirectOnQueueError?: boolean;
}) {
  if (shouldPreferDirectDispatchInDev(input.fallbackToDirectOnQueueError)) {
    return dispatchInternalJobByName(input.job, input.payload);
  }

  if (!isDatabaseConfigured()) {
    if (!input.fallbackToDirectOnQueueError) {
      throw new Error("DATABASE_URL must be configured to enqueue internal jobs (Postgres-backed queue).");
    }

    console.warn(
      `[internal-jobs] postgres queue unavailable for ${input.job} (DATABASE_URL missing), falling back to direct dispatch`,
    );
    return dispatchInternalJobByName(input.job, input.payload);
  }

  try {
    const enqueued = await enqueueProcessingJob({
      kind: input.job,
      payload: input.payload,
      jobKey: input.jobKey,
    });

    if (!enqueued) {
      throw new Error(`Failed to enqueue processing job (${input.job}).`);
    }

    return {
      accepted: true,
      jobId: enqueued.id,
      mode: "postgres" as const,
      queueName: "processing_jobs" as const,
      created: enqueued.created,
    };
  } catch (error) {
    if (!input.fallbackToDirectOnQueueError) {
      throw error;
    }

    console.warn(
      `[internal-jobs] postgres enqueue failed for ${input.job}, falling back to direct dispatch`,
      error,
    );
    return dispatchInternalJobByName(input.job, input.payload);
  }
}

async function dispatchInternalJobByName<TName extends InternalJobName>(
  job: TName,
  jobPayload: InternalJobPayloadMap[TName],
) {
  const responsePayload = await dispatchInternalJob<{
    accepted?: boolean;
    failed?: boolean;
    status?: string;
  }>({
    path: internalJobPathByName[job],
    body: jobPayload as Record<string, unknown>,
  });

  return {
    accepted: responsePayload?.accepted ?? !responsePayload?.failed,
    jobId: null,
    mode: "direct" as const,
    queueName: null,
    status: responsePayload?.status ?? null,
  };
}
