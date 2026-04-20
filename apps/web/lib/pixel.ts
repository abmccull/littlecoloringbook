declare global {
  interface Window {
    _fbq?: Window["fbq"];
    fbq?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => void;
  }
}

type TrackEventParams = Record<string, unknown>;

type TrackEventOptions = {
  /**
   * Override the generated event_id. Pass a stable, deterministic value
   * (e.g. `purchase_${orderId}`) when the same event might also be sent
   * server-side via CAPI — Meta uses event_id to deduplicate between
   * pixel and CAPI. Without a matching event_id, Meta double-counts.
   */
  eventId?: string;
  /**
   * Skip the client-side CAPI enqueue and only fire the browser pixel.
   * Use for events where the server handles CAPI itself (e.g. Purchase
   * via Stripe webhook). Prevents duplicate CAPI inserts on the same
   * deterministic event_id.
   */
  skipCapiEnqueue?: boolean;
};

const standardPixelEvents = new Set([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "PageView",
  "Purchase",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent",
]);

export function initPixel(): void {
  if (typeof window === "undefined") return;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;
  if (window.fbq) return;

  type FbqStub = Window["fbq"] & {
    callMethod?: (...args: unknown[]) => void;
    loaded?: boolean;
    push?: Window["fbq"];
    queue?: unknown[][];
    version?: string;
  };

  // Mirror Meta's expected bootstrap contract so fbevents.js can drain the queue.
  const n = function (...args: unknown[]) {
    if (n.callMethod) {
      n.callMethod(...args);
      return;
    }

    n.queue = n.queue ?? [];
    n.queue.push(args);
  } as FbqStub;

  if (!window._fbq) {
    window._fbq = n;
  }

  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  window.fbq = n;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq?.("init", pixelId);
}

export function trackEvent(name: string, params: TrackEventParams = {}, options: TrackEventOptions = {}): void {
  if (typeof window === "undefined") return;

  const eventId = options.eventId ?? crypto.randomUUID();

  if (window.fbq) {
    const command = standardPixelEvents.has(name) ? "track" : "trackCustom";
    window.fbq(command, name, params, { eventID: eventId });
  }

  if (options.skipCapiEnqueue) return;

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
