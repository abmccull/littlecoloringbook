import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyAttributionCookies } from "./lib/attribution-cookies";

const ADMIN_PATH = /^\/admin(?:$|\/|\?)/;
const HANDLER_SIGNIN_PATH = /^\/api\/auth\/(?:sign-in|send-magic-link|otp|magic-link)/;

// Naive in-memory sliding window. Fine for a single Vercel instance;
// swap for a distributed KV store once we need global rate limiting.
const signInWindow = new Map<string, number[]>();
const SIGN_IN_WINDOW_MS = 60_000;
const SIGN_IN_MAX_REQUESTS = 5;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const prior = signInWindow.get(ip) ?? [];
  const kept = prior.filter((ts) => now - ts < SIGN_IN_WINDOW_MS);
  if (kept.length >= SIGN_IN_MAX_REQUESTS) {
    signInWindow.set(ip, kept);
    return true;
  }
  kept.push(now);
  signInWindow.set(ip, kept);
  return false;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.method === "POST" && HANDLER_SIGNIN_PATH.test(pathname)) {
    if (isRateLimited(getClientIp(request))) {
      return new NextResponse("Too many sign-in attempts. Try again in a minute.", { status: 429 });
    }
  }

  // /admin and /account are guarded server-side by requireAdminSession /
  // requireCustomerSession respectively. The proxy only provides an extra
  // defensive 503 when Neon Auth is not configured in production.
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  const authMissing =
    !process.env.NEON_AUTH_BASE_URL ||
    !cookieSecret ||
    cookieSecret.length < 32;

  if (
    process.env.NODE_ENV === "production" &&
    authMissing &&
    (ADMIN_PATH.test(pathname) || pathname.startsWith("/account"))
  ) {
    return new NextResponse("Auth is not configured.", { status: 503 });
  }

  return applyAttributionCookies(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
