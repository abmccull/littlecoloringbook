/**
 * Read the Meta click identifiers (`_fbc` / `_fbp`) that the Meta pixel
 * drops as first-party cookies. Returns `{}` on the server. Safe to call
 * anywhere on the client — silently no-ops if cookies aren't present or
 * document isn't available.
 *
 * Used by the checkout POST so fbc/fbp can be forwarded into Stripe
 * session metadata and surfaced to the CAPI Purchase event on the
 * webhook side for high-EMQ attribution.
 */

export type MetaClickIds = {
  fbc?: string;
  fbp?: string;
};

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function deriveFbcFromFbclid(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}

export function readMetaClickIds(): MetaClickIds {
  if (typeof window === "undefined") return {};
  const fbc = readCookie("_fbc") ?? deriveFbcFromFbclid();
  const fbp = readCookie("_fbp");
  return {
    ...(fbc ? { fbc } : {}),
    ...(fbp ? { fbp } : {}),
  };
}
