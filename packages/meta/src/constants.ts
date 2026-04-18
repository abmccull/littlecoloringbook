export const CAPI_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Subscribe",
] as const;

export const CAPI_ACTION_SOURCES = [
  "website",
  "email",
  "app",
  "phone_call",
  "chat",
  "physical_store",
  "system_generated",
  "other",
] as const;

export const GRAPH_API_BASE = "https://graph.facebook.com";

// Per-app token bucket: 95 req/sec, leaving 5 req/sec headroom under the 100 QPS cap.
export const APP_RATE_LIMIT_RPS = 95;

// Per-ad-account: 180k/hour under Standard tier 190k limit.
export const AD_ACCOUNT_RATE_LIMIT_PER_HOUR = 180_000;

export const BACKOFF_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;

// HTTP / Graph API error codes that indicate rate-limiting or transient failure.
export const RATE_LIMIT_ERROR_CODES = [613, 17, 2446079] as const;
