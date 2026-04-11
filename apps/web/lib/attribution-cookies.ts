import type { NextRequest, NextResponse } from "next/server";

const VISITOR_COOKIE = "lcb_vid";
const SESSION_COOKIE = "lcb_sid";
const FIRST_TOUCH_COOKIE = "lcb_ft";
const LAST_TOUCH_COOKIE = "lcb_lt";

const VISITOR_MAX_AGE = 60 * 60 * 24 * 180;
const SESSION_MAX_AGE = 60 * 30;
const TOUCH_MAX_AGE = 60 * 60 * 24 * 180;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_ID_KEYS = ["gclid", "fbclid", "ttclid", "msclkid", "gbraid", "wbraid"] as const;

export type AttributionTouch = {
  capturedAt: string;
  landingPath: string;
  referrer: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  clickIds?: Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;
};

export type AttributionCookieSnapshot = {
  visitorId: string;
  sessionId: string;
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
};

function parseCookieJson<T>(raw: string | undefined): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return null;
  }
}

function serializeCookieJson(value: unknown) {
  return encodeURIComponent(JSON.stringify(value));
}

function readStringParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  return value ? value.slice(0, 240) : null;
}

function getExternalReferrer(request: NextRequest) {
  const referer = request.headers.get("referer");

  if (!referer) {
    return null;
  }

  try {
    const url = new URL(referer);
    if (url.origin === request.nextUrl.origin) {
      return null;
    }

    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function getLandingPath(request: NextRequest) {
  const search = request.nextUrl.search;
  return `${request.nextUrl.pathname}${search}`.slice(0, 500);
}

function hasMarketingParams(request: NextRequest) {
  return [...UTM_KEYS, ...CLICK_ID_KEYS].some((key) => Boolean(readStringParam(request, key)));
}

function buildTouch(request: NextRequest): AttributionTouch {
  const clickIds = CLICK_ID_KEYS.reduce<Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>>((accumulator, key) => {
    const value = readStringParam(request, key);

    if (value) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});

  return {
    capturedAt: new Date().toISOString(),
    landingPath: getLandingPath(request),
    referrer: getExternalReferrer(request),
    utmSource: readStringParam(request, "utm_source"),
    utmMedium: readStringParam(request, "utm_medium"),
    utmCampaign: readStringParam(request, "utm_campaign"),
    utmContent: readStringParam(request, "utm_content"),
    utmTerm: readStringParam(request, "utm_term"),
    clickIds: Object.keys(clickIds).length > 0 ? clickIds : undefined,
  };
}

function makeCookieOptions(maxAge: number) {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function readAttributionSnapshot(request: NextRequest): AttributionCookieSnapshot {
  return {
    visitorId: request.cookies.get(VISITOR_COOKIE)?.value ?? crypto.randomUUID(),
    sessionId: request.cookies.get(SESSION_COOKIE)?.value ?? crypto.randomUUID(),
    firstTouch: parseCookieJson<AttributionTouch>(request.cookies.get(FIRST_TOUCH_COOKIE)?.value),
    lastTouch: parseCookieJson<AttributionTouch>(request.cookies.get(LAST_TOUCH_COOKIE)?.value),
  };
}

export function applyAttributionCookies(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET" || request.nextUrl.pathname.startsWith("/api")) {
    return response;
  }

  const snapshot = readAttributionSnapshot(request);
  const currentTouch = buildTouch(request);
  const currentTouchIsAttributable = hasMarketingParams(request) || Boolean(currentTouch.referrer);

  const firstTouch = snapshot.firstTouch ?? currentTouch;
  const lastTouch =
    currentTouchIsAttributable || !snapshot.lastTouch
      ? currentTouch
      : snapshot.lastTouch;

  response.cookies.set(VISITOR_COOKIE, snapshot.visitorId, makeCookieOptions(VISITOR_MAX_AGE));
  response.cookies.set(SESSION_COOKIE, snapshot.sessionId, makeCookieOptions(SESSION_MAX_AGE));
  response.cookies.set(FIRST_TOUCH_COOKIE, serializeCookieJson(firstTouch), makeCookieOptions(TOUCH_MAX_AGE));
  response.cookies.set(LAST_TOUCH_COOKIE, serializeCookieJson(lastTouch), makeCookieOptions(TOUCH_MAX_AGE));

  return response;
}
