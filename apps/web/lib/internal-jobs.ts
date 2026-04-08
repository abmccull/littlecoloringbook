import "server-only";

import { NextRequest, NextResponse } from "next/server";

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
