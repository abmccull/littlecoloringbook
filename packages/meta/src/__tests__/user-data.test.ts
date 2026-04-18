import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildNormalizedUserData } from "../user-data";

function h(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

describe("buildNormalizedUserData", () => {
  it("hashes email and produces single-element array", () => {
    const result = buildNormalizedUserData({ email: "alice@example.com" });
    expect(result.em).toEqual([h("alice@example.com")]);
  });

  it("omits fields that are null or invalid", () => {
    const result = buildNormalizedUserData({ email: null, phone: "555", firstName: null });
    expect(result.em).toBeUndefined();
    expect(result.ph).toBeUndefined();
    expect(result.fn).toBeUndefined();
  });

  it("passes browser/IP fields through untouched", () => {
    const result = buildNormalizedUserData({
      fbp: "_fbp.1.abc",
      fbc: "_fbc.1.def",
      clientIpAddress: "1.2.3.4",
      clientUserAgent: "Mozilla/5.0",
    });
    expect(result.fbp).toBe("_fbp.1.abc");
    expect(result.fbc).toBe("_fbc.1.def");
    expect(result.client_ip_address).toBe("1.2.3.4");
    expect(result.client_user_agent).toBe("Mozilla/5.0");
    expect(result.em).toBeUndefined();
  });

  it("handles mixed inputs correctly", () => {
    const result = buildNormalizedUserData({
      email: "Test@Example.com",
      firstName: "Alice",
      lastName: "Smith",
      phone: "+15555550100",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "US",
      fbp: "_fbp.token",
    });
    expect(result.em).toEqual([h("test@example.com")]);
    expect(result.fn).toEqual([h("alice")]);
    expect(result.ln).toEqual([h("smith")]);
    expect(result.ph).toEqual([h("15555550100")]);
    expect(result.ct).toEqual([h("new york")]);
    expect(result.st).toEqual([h("ny")]);
    expect(result.zp).toEqual([h("10001")]);
    expect(result.country).toEqual([h("us")]);
    expect(result.fbp).toBe("_fbp.token");
  });

  it("omits empty arrays from output", () => {
    const result = buildNormalizedUserData({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});
