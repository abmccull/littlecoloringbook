declare global {
  interface Window {
    fbq?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => void;
  }
}

type TrackEventParams = Record<string, unknown>;

export function initPixel(): void {
  if (typeof window === "undefined") return;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;
  if (window.fbq) return;

  // Standard Meta pixel base code injected at runtime.
  const n = function (...args: unknown[]) {
    (n as unknown as { q?: unknown[] }).q = (n as unknown as { q?: unknown[] }).q ?? [];
    (n as unknown as { q: unknown[] }).q.push(args);
  } as unknown as Window["fbq"];

  Object.assign(n as object, {
    callMethod: n,
    queue: [],
    version: "2.0",
    loaded: true,
  });

  window.fbq = n;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq?.("init", pixelId);
}

export function trackEvent(name: string, params: TrackEventParams = {}): void {
  if (typeof window === "undefined") return;

  const eventId = crypto.randomUUID();

  if (window.fbq) {
    window.fbq("track", name, params, { eventID: eventId });
  }

  const payload = {
    event_name: name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: window.location.href,
    action_source: "website",
    custom_data: params,
    user_data: {
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc") ?? getQueryFbc(),
      client_user_agent: navigator.userAgent,
    },
  };

  fetch("/api/capi/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err: unknown) => {
    console.error("[pixel] CAPI enqueue failed", err);
  });
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getQueryFbc(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}
