import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { enqueueInternalJob as enqueueQueuedInternalJob, isQueueConfigured, type InternalJobName, type InternalJobPayloadMap } from "@littlecolorbook/queue";

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
  "batch-submit-lulu": "/api/internal/jobs/batch-submit-lulu",
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
  });

  const payload = (await response.json().catch(() => null)) as TResponse | { error?: string } | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : `Internal job request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as TResponse;
}

export async function enqueueInternalJob<TName extends InternalJobName>(input: {
  job: TName;
  payload: InternalJobPayloadMap[TName];
}) {
  if (isQueueConfigured()) {
    const queuedJob = await enqueueQueuedInternalJob(input.job, input.payload);

    return {
      accepted: true,
      jobId: queuedJob.id ?? null,
      mode: "queue" as const,
      queueName: queuedJob.queueName,
    };
  }

  const payload = await dispatchInternalJob<{
    accepted?: boolean;
    status?: string;
  }>({
    path: internalJobPathByName[input.job],
    body: input.payload as Record<string, unknown>,
  });

  return {
    accepted: payload?.accepted ?? true,
    jobId: null,
    mode: "direct" as const,
    queueName: null,
    status: payload?.status ?? null,
  };
}
