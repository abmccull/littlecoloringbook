import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeGender,
  normalizeLocation,
  normalizeDob,
  normalizeName,
  normalizePhone,
  sha256Hex,
} from "../pii";

function h(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

describe("sha256Hex", () => {
  it("produces 64-char lowercase hex", () => {
    const result = sha256Hex("hello");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims before hashing", () => {
    expect(normalizeEmail("  Test@Example.COM  ")).toBe(h("test@example.com"));
  });

  it("returns the same hash for already-normalised email", () => {
    expect(normalizeEmail("user@example.com")).toBe(h("user@example.com"));
  });

  it("passes through an already-hashed value unchanged (lowercased)", () => {
    const hashed = h("user@example.com");
    expect(normalizeEmail(hashed)).toBe(hashed.toLowerCase());
  });

  it("returns undefined for null", () => {
    expect(normalizeEmail(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeEmail("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(normalizeEmail("   ")).toBeUndefined();
  });
});

describe("normalizePhone", () => {
  it("strips non-digits and hashes a valid E.164 number", () => {
    expect(normalizePhone("+1 (555) 867-5309")).toBe(h("15558675309"));
  });

  it("requires at least 11 digits (country code + 10)", () => {
    expect(normalizePhone("5558675309")).toBeUndefined(); // 10 digits, no country code
  });

  it("accepts 11-digit number without formatting", () => {
    expect(normalizePhone("15558675309")).toBe(h("15558675309"));
  });

  it("passes through an already-hashed value", () => {
    const hashed = h("15558675309");
    expect(normalizePhone(hashed)).toBe(hashed.toLowerCase());
  });

  it("returns undefined for null", () => {
    expect(normalizePhone(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizePhone("")).toBeUndefined();
  });
});

describe("normalizeName", () => {
  it("lowercases and trims before hashing", () => {
    expect(normalizeName("  ALICE  ")).toBe(h("alice"));
  });

  it("passes through an already-hashed value", () => {
    const hashed = h("alice");
    expect(normalizeName(hashed)).toBe(hashed.toLowerCase());
  });

  it("returns undefined for null", () => {
    expect(normalizeName(null)).toBeUndefined();
  });
});

describe("normalizeDob", () => {
  it("strips non-digits from YYYY-MM-DD and hashes", () => {
    expect(normalizeDob("1990-01-15")).toBe(h("19900115"));
  });

  it("accepts YYYYMMDD directly", () => {
    expect(normalizeDob("19900115")).toBe(h("19900115"));
  });

  it("returns undefined when digit count is wrong", () => {
    expect(normalizeDob("199001")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizeDob(null)).toBeUndefined();
  });

  it("passes through an already-hashed value", () => {
    const hashed = h("19900115");
    expect(normalizeDob(hashed)).toBe(hashed.toLowerCase());
  });
});

describe("normalizeGender", () => {
  it("maps 'male' to 'm' and hashes", () => {
    expect(normalizeGender("male")).toBe(h("m"));
  });

  it("maps 'female' to 'f' and hashes", () => {
    expect(normalizeGender("FEMALE")).toBe(h("f"));
  });

  it("accepts 'm' directly", () => {
    expect(normalizeGender("m")).toBe(h("m"));
  });

  it("returns undefined for unrecognised gender", () => {
    expect(normalizeGender("other")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizeGender(null)).toBeUndefined();
  });
});

describe("normalizeLocation", () => {
  it("lowercases and trims", () => {
    expect(normalizeLocation("  New York  ")).toBe(h("new york"));
  });

  it("returns undefined for null", () => {
    expect(normalizeLocation(null)).toBeUndefined();
  });
});
