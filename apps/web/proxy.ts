import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyAttributionCookies } from "./lib/attribution-cookies";

const isProtectedRoute = createRouteMatcher(["/admin(.*)"]);

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkConfigured) {
    if (process.env.NODE_ENV === "production" && isProtectedRoute(request)) {
      return new NextResponse("Admin auth is not configured.", { status: 503 });
    }

    return applyAttributionCookies(request, NextResponse.next());
  }

  const response = await clerkProxy(request, event);
  const baseResponse = response
    ? response instanceof NextResponse
      ? response
      : new NextResponse(response.body, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        })
    : NextResponse.next();
  return applyAttributionCookies(request, baseResponse);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
