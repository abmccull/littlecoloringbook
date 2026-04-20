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

const META_FBC_STORAGE_KEY = "meta:fbc";
const META_FBP_STORAGE_KEY = "meta:fbp";
const META_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${META_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readStorage(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; cookie persistence still helps.
  }
}

function deriveFbcFromFbclid(existingFbc?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return undefined;

  if (existingFbc) {
    const parts = existingFbc.split(".");
    const existingFbclid = parts.slice(3).join(".");
    if (parts[0] === "fb" && parts[1] === "1" && existingFbclid === fbclid) {
      return existingFbc;
    }
  }

  return `fb.1.${Date.now()}.${fbclid}`;
}

function persistMetaClickId(cookieName: "_fbc" | "_fbp", storageKey: string, value?: string) {
  if (!value) return undefined;
  writeStorage(storageKey, value);
  writeCookie(cookieName, value);
  return value;
}

export function readMetaClickIds(): MetaClickIds {
  if (typeof window === "undefined") return {};

  const cachedFbc = readCookie("_fbc") ?? readStorage(META_FBC_STORAGE_KEY);
  const fbc = persistMetaClickId("_fbc", META_FBC_STORAGE_KEY, cachedFbc ?? deriveFbcFromFbclid(cachedFbc));
  const fbp = persistMetaClickId("_fbp", META_FBP_STORAGE_KEY, readCookie("_fbp") ?? readStorage(META_FBP_STORAGE_KEY));

  return {
    ...(fbc ? { fbc } : {}),
    ...(fbp ? { fbp } : {}),
  };
}
