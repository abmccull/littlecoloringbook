import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { enqueueInternalJob as enqueueQueuedInternalJob, isQueueConfigured, type InternalJobName, type InternalJobPayloadMap } from "@littlecolorbook/queue";
import { enqueueProcessingJob, isDatabaseConfigured } from "@littlecolorbook/db";
import type { ProcessingJobKind, ProcessingJobPayloadMap } from "@littlecolorbook/db";

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
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be configured before dispatching internal jobs in production.");
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

/**
 * Enqueue an internal job. Postgres is the source of truth —
 * enqueueProcessingJob writes a row that the dedicated Postgres
 * polling worker will pick up within ~2s.
 *
 * Legacy paths (BullMQ + synchronous HTTP dispatch) remain gated
 * behind env flags so we have a quick escape hatch during cutover:
 *
 *   FORCE_LEGACY_BULLMQ=true   → skip Postgres, use the BullMQ path
 *                                 (with HTTP fallback on enqueue error)
 *
 * Default (both flags unset): Postgres only. BullMQ is ignored.
 */
export async function enqueueInternalJob<TName extends InternalJobName>(input: {
  job: TName;
  payload: InternalJobPayloadMap[TName];
  /** Optional deduplication key. Writes the same job_key column used by the Postgres worker. */
  jobKey?: string;
  /** @deprecated — retained for signature compatibility during the cutover. Ignored on the Postgres path. */
  fallbackToDirectOnQueueError?: boolean;
}) {
  // Legacy escape hatch — flip this if the Postgres worker is down
  // and we need to re-enable BullMQ as a temporary fallback.
  if (process.env.FORCE_LEGACY_BULLMQ === "true") {
    return enqueueViaLegacyBullMQ(input);
  }

  // Default path — Postgres-backed queue. The worker polls this table
  // every ~2s and dispatches to the same internal-job handlers the
  // BullMQ worker used to call.
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL must be configured to enqueue internal jobs (Postgres-backed queue).");
  }

  const enqueued = await enqueueProcessingJob({
    kind: input.job as ProcessingJobKind,
    payload: input.payload as ProcessingJobPayloadMap[ProcessingJobKind],
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
}

async function enqueueViaLegacyBullMQ<TName extends InternalJobName>(input: {
  job: TName;
  payload: InternalJobPayloadMap[TName];
  fallbackToDirectOnQueueError?: boolean;
}) {
  if (isQueueConfigured()) {
    try {
      const queuedJob = await enqueueQueuedInternalJob(input.job, input.payload);
      return {
        accepted: true,
        jobId: queuedJob.id ?? null,
        mode: "queue" as const,
        queueName: queuedJob.queueName,
      };
    } catch (error) {
      if (!input.fallbackToDirectOnQueueError) throw error;
      console.warn(`[internal-jobs] legacy queue enqueue failed for ${input.job}, falling back to direct dispatch`, error);
    }
  }

  const payload = await dispatchInternalJob<{
    accepted?: boolean;
    failed?: boolean;
    status?: string;
  }>({
    path: internalJobPathByName[input.job],
    body: input.payload as Record<string, unknown>,
  });

  return {
    accepted: payload?.accepted ?? !payload?.failed,
    jobId: null,
    mode: "direct" as const,
    queueName: null,
    status: payload?.status ?? null,
  };
}
