import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let cached: NeonAuth | null = null;

export function isNeonAuthConfigured() {
  const url = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!url || !secret) return false;
  if (url.startsWith("FILL_ME") || secret.startsWith("FILL_ME")) return false;
  if (secret.length < 32) return false;
  return true;
}

/**
 * Lazy accessor for the Neon Auth server instance. Deferring construction
 * avoids a build-time crash when env vars are absent (preview deploys,
 * fresh checkouts, build step without secrets).
 */
export function getNeonAuth(): NeonAuth {
  if (cached) return cached;

  cached = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
  });

  return cached;
}

/**
 * Kick off the email-OTP sign-in flow on the upstream Neon Auth server.
 * The dashboard's "Verification link" / "Verification code" toggle
 * controls whether Neon sends a clickable link or a 6-digit code.
 *
 * This also auto-creates the user if they don't exist yet. Safe to call
 * from server actions and the Stripe webhook.
 */
export async function sendSignInOtp(input: {
  email: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isNeonAuthConfigured()) {
    return { ok: false, error: "neon_auth_not_configured" };
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL!.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        type: "sign-in",
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: text || response.statusText };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}
