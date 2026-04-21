import * as Sentry from "@sentry/nextjs";
import { assertAppUrlAtBoot } from "@littlecolorbook/shared/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate APP_URL before anything else boots. Throws if APP_URL is
    // non-https in prod, or if its hostname drifts from
    // APP_URL_CANONICAL_HOST. This is the guardrail against the
    // 2026-04-20 incident where an apex→www redirect silently stripped
    // Authorization headers on internal-HTTP job dispatch.
    assertAppUrlAtBoot();
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
