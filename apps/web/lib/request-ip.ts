import "server-only";

import type { NextRequest } from "next/server";

/**
 * Extract the end-user's IP address from a Next.js request. Respects the
 * standard proxy chain (`x-forwarded-for` wins, `x-real-ip` falls back).
 * Returns "unknown" if neither header is present so callers can branch
 * on it without null-checking.
 */
export function extractClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
