import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readMetaClickIds } from "../meta-click-ids";
import { extractClientIp, extractClientUserAgent } from "../request-ip";

type BrowserHarness = {
  cookieStore: Map<string, string>;
  localStorageStore: Map<string, string>;
};

function installBrowserHarness(search = ""): BrowserHarness {
  const cookieStore = new Map<string, string>();
  const localStorageStore = new Map<string, string>();

  const document = {} as { cookie: string };
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get() {
      return Array.from(cookieStore.entries())
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join("; ");
    },
    set(value: string) {
      const [cookiePair] = value.split(";", 1);
      const separatorIndex = cookiePair.indexOf("=");
      if (separatorIndex === -1) return;
      const name = cookiePair.slice(0, separatorIndex).trim();
      const encodedValue = cookiePair.slice(separatorIndex + 1);
      cookieStore.set(name, decodeURIComponent(encodedValue));
    },
  });

  const localStorage = {
    getItem(key: string) {
      return localStorageStore.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      localStorageStore.set(key, value);
    },
    clear() {
      localStorageStore.clear();
    },
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    location: { search },
    localStorage,
  });

  return { cookieStore, localStorageStore };
}

describe("readMetaClickIds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T16:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reuses an existing persisted fbc for the same fbclid and backfills storage", () => {
    const { cookieStore, localStorageStore } = installBrowserHarness("?fbclid=fbclid-123");
    cookieStore.set("_fbc", "fb.1.1700000000000.fbclid-123");
    cookieStore.set("_fbp", "fb.1.1700000000000.abc");

    const ids = readMetaClickIds();

    expect(ids).toEqual({
      fbc: "fb.1.1700000000000.fbclid-123",
      fbp: "fb.1.1700000000000.abc",
    });
    expect(localStorageStore.get("meta:fbc")).toBe("fb.1.1700000000000.fbclid-123");
    expect(localStorageStore.get("meta:fbp")).toBe("fb.1.1700000000000.abc");
  });

  it("derives and persists a stable fbc when only fbclid is present", () => {
    const { cookieStore, localStorageStore } = installBrowserHarness("?fbclid=landing-click");

    const first = readMetaClickIds();
    const second = readMetaClickIds();

    expect(first.fbc).toBe("fb.1.1776700800000.landing-click");
    expect(second.fbc).toBe(first.fbc);
    expect(cookieStore.get("_fbc")).toBe(first.fbc);
    expect(localStorageStore.get("meta:fbc")).toBe(first.fbc);
  });
});

describe("request attribution helpers", () => {
  it("prefers x-forwarded-for when extracting client IP", () => {
    const request = {
      headers: new Headers({
        "x-forwarded-for": "198.51.100.10, 203.0.113.8",
        "x-real-ip": "203.0.113.8",
      }),
    };

    expect(extractClientIp(request as never)).toBe("198.51.100.10");
  });

  it("extracts and trims the browser user agent", () => {
    const request = {
      headers: new Headers({
        "user-agent": "  Mozilla/5.0 LittleColorBookTest  ",
      }),
    };

    expect(extractClientUserAgent(request as never)).toBe("Mozilla/5.0 LittleColorBookTest");
  });

  it("returns null when the browser user agent is missing", () => {
    const request = {
      headers: new Headers(),
    };

    expect(extractClientUserAgent(request as never)).toBeNull();
  });
});
