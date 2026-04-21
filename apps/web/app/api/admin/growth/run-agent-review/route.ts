// Admin-gated manual trigger for the brief-agent. Lets operators
// invoke the daily agent-review cron on demand from
// /admin/growth/journal without waiting for 14:00 UTC.
//
// Forwards to /api/cron/agent-review with the CRON_SECRET bearer
// token so the cron handler's auth check passes. The cron response is
// returned verbatim to the client for transparency.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "../../../../../lib/auth";
import { getInternalJobSecret } from "../../../../../lib/internal-jobs";
import { getAppUrl } from "../../../../../lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_request: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret = getInternalJobSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured — agent cannot run manually or via schedule." },
      { status: 503 },
    );
  }

  const url = new URL("/api/cron/agent-review", getAppUrl()).toString();
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
      // Redirect: manual — APP_URL must be canonical www; apex→www strips
      // the Authorization header silently. See lessons.md 2026-04-20.
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "(none)";
      return NextResponse.json(
        {
          error: `Cron dispatch redirected ${response.status} to ${location}. Set APP_URL to the canonical www domain.`,
        },
        { status: 502 },
      );
    }

    const body = await response.json().catch(() => ({ error: "Invalid JSON from cron route" }));
    const durationMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        ...body,
        triggeredBy: session.email,
        durationMs,
      },
      { status: response.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to dispatch agent-review cron",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
