import { describe, it, expect } from "vitest";
import { matchAutoReply } from "../auto-reply";
import type { KeywordResponse } from "../auto-reply";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rule(
  overrides: Partial<KeywordResponse> & {
    matchKind: KeywordResponse["matchKind"];
    matchPattern: string;
  },
): KeywordResponse {
  return {
    id: "kr_test",
    responseBody: "Here is your reply.",
    platform: null,
    ...overrides,
  };
}

// ─── exact ────────────────────────────────────────────────────────────────────

describe("matchAutoReply — exact", () => {
  it("matches when text equals pattern (case-insensitive)", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "sample" })];
    expect(matchAutoReply("Sample", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("SAMPLE", "fb_messenger", rules)).toBeTruthy();
  });

  it("matches after trimming leading/trailing whitespace", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "sample" })];
    expect(matchAutoReply("  sample  ", "fb_messenger", rules)).toBeTruthy();
  });

  it("does NOT match partial text", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "sample" })];
    expect(matchAutoReply("can I get a sample link", "fb_messenger", rules)).toBeNull();
  });

  it("returns null for empty incoming text when pattern is non-empty", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "sample" })];
    expect(matchAutoReply("", "fb_messenger", rules)).toBeNull();
  });

  it("matches empty pattern against empty text", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "" })];
    expect(matchAutoReply("", "fb_messenger", rules)).toBeTruthy();
  });
});

// ─── contains ─────────────────────────────────────────────────────────────────

describe("matchAutoReply — contains", () => {
  it("matches when text contains the pattern anywhere", () => {
    const rules = [rule({ matchKind: "contains", matchPattern: "sample" })];
    expect(matchAutoReply("can I get a sample link", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("sample please", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("here is the sample", "fb_messenger", rules)).toBeTruthy();
  });

  it("is case-insensitive", () => {
    const rules = [rule({ matchKind: "contains", matchPattern: "Sample" })];
    expect(matchAutoReply("please send SAMPLE", "fb_messenger", rules)).toBeTruthy();
  });

  it("does NOT match when pattern is absent", () => {
    const rules = [rule({ matchKind: "contains", matchPattern: "sample" })];
    expect(matchAutoReply("hello there", "fb_messenger", rules)).toBeNull();
  });
});

// ─── prefix ───────────────────────────────────────────────────────────────────

describe("matchAutoReply — prefix", () => {
  it("matches when text starts with the pattern", () => {
    const rules = [rule({ matchKind: "prefix", matchPattern: "hi" })];
    expect(matchAutoReply("hi there!", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("Hi, how are you?", "fb_messenger", rules)).toBeTruthy();
  });

  it("does NOT match when pattern is in the middle", () => {
    const rules = [rule({ matchKind: "prefix", matchPattern: "hi" })];
    expect(matchAutoReply("say hi to me", "fb_messenger", rules)).toBeNull();
  });

  it("is case-insensitive", () => {
    const rules = [rule({ matchKind: "prefix", matchPattern: "HELLO" })];
    expect(matchAutoReply("hello world", "fb_messenger", rules)).toBeTruthy();
  });
});

// ─── regex ────────────────────────────────────────────────────────────────────

describe("matchAutoReply — regex", () => {
  it("matches text against a valid regex pattern", () => {
    const rules = [rule({ matchKind: "regex", matchPattern: "^hi|^hello" })];
    expect(matchAutoReply("hi there", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("hello world", "fb_messenger", rules)).toBeTruthy();
  });

  it("is case-insensitive (i flag applied)", () => {
    const rules = [rule({ matchKind: "regex", matchPattern: "^sample" })];
    expect(matchAutoReply("SAMPLE LINK", "fb_messenger", rules)).toBeTruthy();
  });

  it("skips rule silently when regex is invalid", () => {
    const invalidRule = rule({ matchKind: "regex", matchPattern: "[invalid(" });
    const validRule = rule({
      id: "kr_valid",
      matchKind: "exact",
      matchPattern: "hello",
      responseBody: "Matched valid rule.",
    });
    // The invalid regex rule must not crash; the valid rule should still match.
    expect(matchAutoReply("hello", "fb_messenger", [invalidRule, validRule])).toEqual(
      expect.objectContaining({ id: "kr_valid" }),
    );
  });

  it("returns null when no regex matches", () => {
    const rules = [rule({ matchKind: "regex", matchPattern: "^order-\\d+" })];
    expect(matchAutoReply("hello world", "fb_messenger", rules)).toBeNull();
  });
});

// ─── Platform filter ──────────────────────────────────────────────────────────

describe("matchAutoReply — platform filter", () => {
  it("applies rule with null platform to both platforms", () => {
    const rules = [rule({ matchKind: "exact", matchPattern: "hi", platform: null })];
    expect(matchAutoReply("hi", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("hi", "ig_direct", rules)).toBeTruthy();
  });

  it("skips rule when platform does not match", () => {
    const rules = [
      rule({ matchKind: "exact", matchPattern: "hi", platform: "ig_direct" }),
    ];
    expect(matchAutoReply("hi", "fb_messenger", rules)).toBeNull();
  });

  it("matches rule when platform matches exactly", () => {
    const rules = [
      rule({ matchKind: "exact", matchPattern: "hi", platform: "fb_messenger" }),
    ];
    expect(matchAutoReply("hi", "fb_messenger", rules)).toBeTruthy();
    expect(matchAutoReply("hi", "ig_direct", rules)).toBeNull();
  });
});

// ─── First-match-wins ─────────────────────────────────────────────────────────

describe("matchAutoReply — first-match-wins", () => {
  it("returns the first matching rule when multiple match", () => {
    const rules: KeywordResponse[] = [
      { id: "kr_first", matchKind: "contains", matchPattern: "sample", responseBody: "First", platform: null },
      { id: "kr_second", matchKind: "exact", matchPattern: "sample", responseBody: "Second", platform: null },
    ];
    const result = matchAutoReply("sample", "fb_messenger", rules);
    expect(result?.id).toBe("kr_first");
  });

  it("falls through to the second rule when first does not match", () => {
    const rules: KeywordResponse[] = [
      { id: "kr_first", matchKind: "exact", matchPattern: "nomatch", responseBody: "First", platform: null },
      { id: "kr_second", matchKind: "exact", matchPattern: "hello", responseBody: "Second", platform: null },
    ];
    const result = matchAutoReply("hello", "fb_messenger", rules);
    expect(result?.id).toBe("kr_second");
  });
});

// ─── Empty text safety ────────────────────────────────────────────────────────

describe("matchAutoReply — empty text safety", () => {
  it("handles empty incoming text without throwing", () => {
    const rules: KeywordResponse[] = [
      { id: "kr_1", matchKind: "contains", matchPattern: "hello", responseBody: "Hi!", platform: null },
      { id: "kr_2", matchKind: "regex", matchPattern: ".+", responseBody: "Got text.", platform: null },
    ];
    expect(() => matchAutoReply("", "fb_messenger", rules)).not.toThrow();
    expect(matchAutoReply("", "fb_messenger", rules)).toBeNull();
  });

  it("handles empty rules array without throwing", () => {
    expect(() => matchAutoReply("hello", "fb_messenger", [])).not.toThrow();
    expect(matchAutoReply("hello", "fb_messenger", [])).toBeNull();
  });
});
